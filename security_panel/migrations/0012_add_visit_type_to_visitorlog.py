# Generated manually to add visit_type field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('security_panel', '0011_remove_visitorlog_notes'),
    ]

    operations = [
        migrations.AddField(
            model_name='visitorlog',
            name='visit_type',
            field=models.CharField(
                choices=[('visiting', 'Visiting'), ('package_delivery', 'Package Delivery'), ('food_delivery', 'Food Delivery')],
                default='visiting',
                help_text="Type of visit - visiting person or delivery",
                max_length=20
            ),
        ),
    ]

