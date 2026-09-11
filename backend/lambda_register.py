"""
lambda_register.py
Pabucon 2026 — Registro de asistencia
AWS Lambda Function

Endpoints: POST /register
DynamoDB: pabucon2026-registrations
  PK: deviceId (String)  ← evita multiregistro a nivel de BD
"""

import json
import os
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# ── Config ──────────────────────────────────────────
TABLE_NAME   = os.environ.get('TABLE_NAME', 'pabucon2026-registrations')
MAX_CAPACITY = int(os.environ.get('MAX_CAPACITY', '15'))

dynamodb = boto3.resource('dynamodb')
table    = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type':                 'application/json',
}

# ── Handler ─────────────────────────────────────────
def lambda_handler(event, context):
    method = event.get('httpMethod', 'POST')

    # CORS preflight
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if method != 'POST':
        return _resp(405, {'error': 'Método no permitido'})

    # Parse body
    try:
        body     = json.loads(event.get('body') or '{}')
        nickname = body.get('nickname', '').strip()[:50]
        device_id = body.get('deviceId', '').strip()[:128]
    except (json.JSONDecodeError, AttributeError):
        return _resp(400, {'error': 'JSON inválido'})

    if not nickname:
        return _resp(400, {'error': 'El nickname es requerido'})

    if not device_id:
        return _resp(400, {'error': 'deviceId es requerido'})

    # Check capacity (Scan returns count without fetching items)
    try:
        count_resp = table.scan(Select='COUNT')
        current    = count_resp.get('Count', 0)
    except ClientError as e:
        print(f'[ERROR] scan failed: {e}')
        return _resp(500, {'error': 'Error al consultar la base de datos'})

    if current >= MAX_CAPACITY:
        return _resp(403, {
            'error': '¡Los cupos están llenos!',
            'code':  'FULL'
        })

    # Try to insert (ConditionExpression prevents duplicates)
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(
            Item={
                'deviceId':     device_id,
                'nickname':     nickname,
                'registeredAt': timestamp,
            },
            ConditionExpression='attribute_not_exists(deviceId)'
        )
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ConditionalCheckFailedException':
            return _resp(409, {
                'error': 'Este dispositivo ya está registrado',
                'code':  'DUPLICATE_DEVICE'
            })
        print(f'[ERROR] put_item failed: {e}')
        return _resp(500, {'error': 'Error al guardar el registro'})

    new_total = current + 1
    spots_left = MAX_CAPACITY - new_total

    print(f'[REGISTER] nickname="{nickname}" device="{device_id[:16]}..." total={new_total}')

    return _resp(200, {
        'message':    '¡Registro exitoso!',
        'nickname':   nickname,
        'total':      new_total,
        'spotsLeft':  spots_left,
        'registeredAt': timestamp,
    })


def _resp(status, body):
    return {
        'statusCode': status,
        'headers':    CORS_HEADERS,
        'body':       json.dumps(body, ensure_ascii=False),
    }
