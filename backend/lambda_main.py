"""
lambda_main.py
Pabucon 2026 — Una sola Lambda para todo el backend

Rutas manejadas:
  POST /register       → registrar asistente
  GET  /count          → conteo público de cupos
  GET  /registrations  → lista admin (requiere Authorization: Bearer <password>)
"""

import json
import os
import hashlib
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# ── Config ──────────────────────────────────────────────────────
TABLE_NAME          = os.environ.get('TABLE_NAME', 'pabucon2026-registrations')
MAX_CAPACITY        = int(os.environ.get('MAX_CAPACITY', '15'))
ADMIN_PASSWORD_HASH = os.environ.get('ADMIN_PASSWORD_HASH', '')  # SHA-256 de tu contraseña

dynamodb = boto3.resource('dynamodb')
table    = dynamodb.Table(TABLE_NAME)

CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type':                 'application/json',
}

# ── Entry point ─────────────────────────────────────────────────
def lambda_handler(event, context):
    # HTTP API v2 usa requestContext.http.method + rawPath
    # REST API v1 usa httpMethod + path
    ctx = event.get('requestContext', {})
    http_ctx = ctx.get('http', {})

    method = (
        http_ctx.get('method') or          # HTTP API v2
        event.get('httpMethod') or         # REST API v1
        'GET'
    ).upper()

    path = (
        event.get('rawPath') or            # HTTP API v2
        event.get('path') or               # REST API v1
        '/'
    )

    # CORS preflight
    if method == 'OPTIONS':
        return ok({})

    if method == 'POST' and path.endswith('/register'):
        return handle_register(event)

    if method == 'GET' and path.endswith('/count'):
        return handle_count()

    if method == 'GET' and path.endswith('/registrations'):
        return handle_admin(event)

    return err(404, f'Ruta no encontrada: {method} {path}')


# ── POST /register ───────────────────────────────────────────────
def handle_register(event):
    try:
        body      = json.loads(event.get('body') or '{}')
        nickname  = body.get('nickname', '').strip()[:50]
        device_id = body.get('deviceId', '').strip()[:128]
    except Exception:
        return err(400, 'JSON inválido')

    if not nickname:
        return err(400, 'El nickname es requerido')
    if not device_id:
        return err(400, 'deviceId es requerido')

    # Verificar capacidad
    try:
        count = table.scan(Select='COUNT').get('Count', 0)
    except ClientError as e:
        print(f'[ERROR] scan: {e}')
        return err(500, 'Error interno')

    if count >= MAX_CAPACITY:
        return err(403, '¡Los cupos están llenos!')

    # Insertar (PK deviceId previene duplicados)
    try:
        table.put_item(
            Item={
                'deviceId':     device_id,
                'nickname':     nickname,
                'registeredAt': datetime.now(timezone.utc).isoformat(),
            },
            ConditionExpression='attribute_not_exists(deviceId)'
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return err(409, 'Este dispositivo ya está registrado')
        print(f'[ERROR] put_item: {e}')
        return err(500, 'Error al guardar')

    new_total = count + 1
    print(f'[REGISTRO] {nickname} | total={new_total}')
    return ok({
        'message':   '¡Registro exitoso!',
        'nickname':  nickname,
        'total':     new_total,
        'spotsLeft': MAX_CAPACITY - new_total,
    })


# ── GET /count ───────────────────────────────────────────────────
def handle_count():
    try:
        total = table.scan(Select='COUNT').get('Count', 0)
    except ClientError as e:
        print(f'[ERROR] count scan: {e}')
        return err(500, 'Error interno')

    return ok({
        'total':       total,
        'spotsLeft':   MAX_CAPACITY - total,
        'maxCapacity': MAX_CAPACITY,
        'isFull':      total >= MAX_CAPACITY,
    })


# ── GET /registrations (admin) ───────────────────────────────────
def handle_admin(event):
    auth = event.get('headers', {}).get('Authorization', '')
    if not auth.startswith('Bearer '):
        return err(401, 'No autorizado')

    pwd_hash = hashlib.sha256(auth[7:].encode()).hexdigest()
    if not ADMIN_PASSWORD_HASH or pwd_hash != ADMIN_PASSWORD_HASH:
        return err(401, 'Contraseña incorrecta')

    try:
        items, resp = [], table.scan()
        items.extend(resp.get('Items', []))
        while 'LastEvaluatedKey' in resp:
            resp = table.scan(ExclusiveStartKey=resp['LastEvaluatedKey'])
            items.extend(resp.get('Items', []))
    except ClientError as e:
        print(f'[ERROR] admin scan: {e}')
        return err(500, 'Error interno')

    items.sort(key=lambda x: x.get('registeredAt', ''))
    total = len(items)

    return ok({
        'registrations': [
            {'number': i+1, 'nickname': r['nickname'], 'registeredAt': r.get('registeredAt', '')}
            for i, r in enumerate(items)
        ],
        'total':       total,
        'spotsLeft':   MAX_CAPACITY - total,
        'maxCapacity': MAX_CAPACITY,
    })


# ── Helpers ──────────────────────────────────────────────────────
def ok(body):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}

def err(status, msg):
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}
