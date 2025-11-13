# Generated migration to convert existing PDF resources to document type

from django.db import migrations

def convert_pdf_to_document(apps, schema_editor):
    Resource = apps.get_model('admin_panel', 'Resource')
    # Convert all existing 'pdf' resources to 'document'
    Resource.objects.filter(resource_type='pdf').update(resource_type='document')

def reverse_convert(apps, schema_editor):
    Resource = apps.get_model('admin_panel', 'Resource')
    # Convert back to 'pdf' (though this won't work if pdf is removed from choices)
    # This is just for migration rollback support
    Resource.objects.filter(resource_type='document').update(resource_type='pdf')

class Migration(migrations.Migration):

    dependencies = [
        ('admin_panel', '0005_convert_pdf_to_document'),
    ]

    operations = [
        migrations.RunPython(convert_pdf_to_document, reverse_convert),
    ]

