import logging
from django.db import connection
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.conf import settings

logger = logging.getLogger("receptify.health")


class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        db_status = "disconnected"
        redis_status = "not_configured"
        overall_status = "healthy"

        # 1. Test PostgreSQL DB connectivity
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
                if row and row[0] == 1:
                    db_status = "connected"
        except Exception as e:
            logger.error(f"Health check DB ping failed: {e}")
            db_status = f"error: {str(e)}"
            overall_status = "unhealthy"

        # 2. Test Redis / Celery connectivity if REDIS_URL or CELERY_BROKER_URL is set
        broker_url = getattr(settings, 'CELERY_BROKER_URL', '')
        if broker_url and ('redis://' in broker_url or 'rediss://' in broker_url):
            try:
                import redis
                r = redis.Redis.from_url(broker_url, socket_timeout=2.0)
                if r.ping():
                    redis_status = "connected"
                else:
                    redis_status = "ping_failed"
            except ImportError:
                redis_status = "redis_package_missing"
            except Exception as e:
                logger.warning(f"Health check Redis ping failed: {e}")
                redis_status = "unavailable"

        payload = {
            "status": overall_status,
            "database": db_status,
            "redis": redis_status,
            "timestamp": timezone.now().isoformat()
        }

        http_status = status.HTTP_200_OK if overall_status == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(payload, status=http_status)
