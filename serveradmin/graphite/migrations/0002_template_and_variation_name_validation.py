# -*- coding: utf-8 -*-
# Generated by Django 1.10.8 on 2019-07-25 14:08

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('graphite', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='template',
            name='name',
            field=models.CharField(max_length=255),
        ),
        migrations.AlterField(
            model_name='variation',
            name='name',
            field=models.CharField(max_length=255),
        ),
    ]
