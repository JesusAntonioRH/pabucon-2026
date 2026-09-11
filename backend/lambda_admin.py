"""
lambda_admin.py
Pabucon 2026 — Endpoint protegido para panel de administrador
AWS Lambda Function

Endpoint: GET /registrations
Auth:     Bearer <ADMIN_PASSWORD> (se hashea y compara con variable de entorno)
Retorna:  Lista completa de registros + stats
"""

import json
import os
import hashlib
import boto3
from botocore.exceptions import ClientError

TABLE_NAME           = os.environ.get('TABLE_NAME', 'pabucon2026-registrations')
MAX_CAPACITY         = int(os.environ.get('MAX_CAPACITY', '15'))
# Store SHA-256 hash of the password in this env var (never the plaintext)
# Generate it: python -c "import hashlib; print(hashlib.sha256(b'TuContraseña').hexdigest())"
ADMIN_PASSWORD_HASH  = os.environ.get('ADMIN_PASSWORD_HASH', '')

dynamodb = boto3.resource('dynamodb')
table    = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type':                 'application/json',
    'Cache-Control':                'no-store',
}


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # ── Auth ──────────────────────────────────────────
    auth_header = event.get('headers', {}).get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return _resp(401, {'error': 'No autorizado'})

    provided_pwd  = auth_header[7:]
    provided_hash = hashlib.sha256(provided_pwd.encode('utf-8')).hexdigest()

    if not ADMIN_PASSWORD_HASH or provided_hash != ADMIN_PASSWORD_HASH:
        return _resp(401, {'error': 'Contraseña incorrecta'})

    # ── Fetch all registrations ────────────────────────
    try:
        items = []
        response = table.scan()
        items.extend(response.get('Items', []))

        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))

    except ClientError as e:
        print(f'[ERROR] scan failed: {e}')
        return _resp(500, {'error': 'Error al consultar registros'})

    # Sort by registration time
    items.sort(key=lambda x: x.get('registeredAt', ''))

    total      = len(items)
    spots_left = MAX_CAPACITY - total

    return _resp(200, {
        'registrations': [
            {
                'number':       i + 1,
                'nickname':     item.get('nickname', ''),
                'registeredAt': item.get('registeredAt', ''),
            }
            for i, item in enumerate(items)
        ],
        'total':       total,
        'spotsLeft':   spots_left,
        'maxCapacity': MAX_CAPACITY,
    })


def _resp(status, body):
    return {
        'statusCode': status,
        'headers':    CORS_HEADERS,
        'body':       json.dumps(body, ensure_ascii=False),
    }
