from django.contrib import admin

from serveradmin.apps.models import Application


class ApplicationAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'author',
        'location',
        'auth_token',
        'superuser',
        'disabled',
    ]

    def get_actions(self, request):
        actions = super(ApplicationAdmin, self).get_actions(request)
        del actions['delete_selected']
        return actions

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(Application, ApplicationAdmin)
