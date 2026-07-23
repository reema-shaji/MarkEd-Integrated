from django.urls import path

from MarkEd import settings
from MarkEd.student import views
from django.conf.urls.static import static

urlpatterns = [
    path('home/', views.home),
    path('submit/', views.submit),
    path('feedback/', views.feedback),
    path('notification/', views.notification),
    path('get_file/', views.get_file)
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
