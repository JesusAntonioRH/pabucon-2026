"""
lambda_count.py
Pabucon 2026 — Endpoint público para conteo de cupos
AWS Lambda Function

Endpoint: GET /count
Retorna: { total, spotsLeft, maxCapacity }
No expone datos personales.
"""

import json
import os
import boto3
from botocore.exceptions import ClientError

TABLE_NAME   = os.environ.get('TABLE_NAME', 'pabucon2026-registrations')
MAX_CAPACITY = int(os.environ.get('MAX_CAPACITY', '15'))

dynamodb = boto3.resource('dynamodb')
table    = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type':                 'application/json',
    'Cache-Control':                'no-store',
}


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        resp  = table.scan(Select='COUNT')
        total = resp.get('Count', 0)
    except ClientError as e:
        print(f'[ERROR] scan failed: {e}')
        return {
            'statusCode': 500,
            'headers':    CORS_HEADERS,
            'body':       json.dumps({'error': 'Error interno'})
        }

    return {
        'statusCode': 200,
        'headers':    CORS_HEADERS,
        'body':       json.dumps({
            'total':       total,
            'spotsLeft':   MAX_CAPACITY - total,
            'maxCapacity': MAX_CAPACITY,
            'isFull':      total >= MAX_CAPACITY,
        })
    }
