# Generated manually to update visit_type choices

from django.db import migrations, models


def update_existing_delivery_records(apps, schema_editor):
    """Update any existing 'delivery' records to 'package_delivery'"""
    VisitorLog = apps.get_model('security_panel', 'VisitorLog')
    VisitorLog.objects.filter(visit_type='delivery').update(visit_type='package_delivery')


def reverse_update(apps, schema_editor):
    """Reverse migration - change package_delivery back to delivery"""
    VisitorLog = apps.get_model('security_panel', 'VisitorLog')
    VisitorLog.objects.filter(visit_type='package_delivery').update(visit_type='delivery')


class Migration(migrations.Migration):

    dependencies = [
        ('security_panel', '0012_add_visit_type_to_visitorlog'),
    ]

    operations = [
        # Update existing data first
        migrations.RunPython(update_existing_delivery_records, reverse_update),
        # Then update the field choices
        migrations.AlterField(
            model_name='visitorlog',
            name='visit_type',
            field=models.CharField(
                choices=[
                    ('visiting', 'Visiting'),
                    ('package_delivery', 'Package Delivery'),
                    ('food_delivery', 'Food Delivery')
                ],
                default='visiting',
                help_text="Type of visit - visiting person or delivery",
                max_length=20
            ),
        ),
    ]

