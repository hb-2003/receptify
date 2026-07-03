from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from customers.models import Customer
from campaigns.models import Campaign
from campaigns.serializers import CampaignSerializer
from calls.models import Call
from calls.serializers import CallSerializer
from customers.views import to_camel_case


class AnalyticsView(APIView):
    def get(self, request):
        user = request.user
        business_id = user.business_id

        if not business_id:
            return Response({'summary': None}, status=status.HTTP_200_OK)

        # 1. Standard KPI counts via ORM
        total_customers = Customer.objects.filter(business_id=business_id).count()
        total_campaigns = Campaign.objects.filter(business_id=business_id).count()
        total_calls = Call.objects.filter(campaign__business_id=business_id).count()
        answered = Call.objects.filter(campaign__business_id=business_id, status='completed').count()
        failed = Call.objects.filter(campaign__business_id=business_id, status='failed').count()
        callbacks = Call.objects.filter(campaign__business_id=business_id, outcome='callback_requested').count()

        # Rates
        answer_rate = round((answered / total_calls) * 100) if total_calls else 0
        callback_rate = round((callbacks / total_calls) * 100) if total_calls else 0
        failed_rate = round((failed / total_calls) * 100) if total_calls else 0

        # 2. Raw SQL queries for highly efficient date formatting groupings
        calls_by_day = []
        outcomes_distribution = []

        try:
            with connection.cursor() as cursor:
                # Trends grouped by day (Mon DD format)
                cursor.execute("""
                    SELECT to_char(c.created_at, 'Mon DD') as day, COUNT(*) as count
                    FROM calls c
                    INNER JOIN campaigns campaign ON campaign.id = c.campaign_id
                    WHERE campaign.business_id = %s AND c.created_at > now() - interval '14 days'
                    GROUP BY to_char(c.created_at, 'Mon DD')
                    ORDER BY MIN(c.created_at) ASC
                """, [str(business_id)])
                for row in cursor.fetchall():
                    calls_by_day.append({'day': row[0], 'count': int(row[1])})

                # Outcomes splits
                cursor.execute("""
                    SELECT c.outcome, COUNT(*) as count
                    FROM calls c
                    INNER JOIN campaigns campaign ON campaign.id = c.campaign_id
                    WHERE campaign.business_id = %s
                    GROUP BY c.outcome
                """, [str(business_id)])
                for row in cursor.fetchall():
                    outcomes_distribution.append({'outcome': row[0], 'count': int(row[1])})
        except Exception as e:
            # Fallback to prevent crash if database constraints differ
            print(f"Error executing raw sql: {str(e)}")

        # 3. Recent listings (with pre-fetching optimizations)
        recent_campaigns = Campaign.objects.filter(business_id=business_id).order_by('-created_at')[:5]
        recent_calls = Call.objects.filter(campaign__business_id=business_id).select_related('customer', 'campaign').order_by('-created_at')[:8]

        # Serializations
        campaign_serializer = CampaignSerializer(recent_campaigns, many=True)
        call_serializer = CallSerializer(recent_calls, many=True)

        return Response({
            'totals': {
                'totalCustomers': total_customers,
                'totalCampaigns': total_campaigns,
                'totalCalls': total_calls,
                'answered': answered,
                'failed': failed,
                'callbacks': callbacks
            },
            'answerRate': answer_rate,
            'callbackRate': callback_rate,
            'failedRate': failed_rate,
            'callsByDay': calls_by_day,
            'outcomes': outcomes_distribution,
            'recentCampaigns': [to_camel_case(campaign_item) for campaign_item in campaign_serializer.data],
            'recentCalls': [to_camel_case(call_item) for call_item in call_serializer.data]
        }, status=status.HTTP_200_OK)