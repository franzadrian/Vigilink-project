from django.db import models
from django.contrib.auth.models import AbstractUser

class Registration(models.Model):
    ROLES = [
        ('Admin', 'Admin'),
        ('Student', 'Student'),
        ('Coach', 'Coach'),
        ('TournamentManager', 'Tournament Manager'),
        ('Dean', 'Dean'),
    ]
    
    userName = models.CharField(primary_key=True, max_length=50)
    password = models.CharField(max_length=100)
    confirmPassword = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=ROLES)
    
    def __str__(self):
        return f"{self.userName} ({self.role})"

class Department(models.Model):
    deptID = models.AutoField(primary_key=True)
    deptName = models.CharField(max_length=100)
    
    def __str__(self):
        return self.deptName

class TournamentManager(models.Model):
    userName = models.OneToOneField(Registration, on_delete=models.CASCADE, primary_key=True)
    fName = models.CharField(max_length=50)
    lName = models.CharField(max_length=50)
    mobile = models.CharField(max_length=15)
    deptID = models.ForeignKey(Department, on_delete=models.CASCADE)
    
    def full_name(self):
        return f"{self.fName} {self.lName}"
    
    def __str__(self):
        return self.full_name()

class Coach(models.Model):
    userName = models.OneToOneField(Registration, on_delete=models.CASCADE, primary_key=True)
    fName = models.CharField(max_length=50)
    lName = models.CharField(max_length=50)
    mobile = models.CharField(max_length=15)
    deptID = models.ForeignKey(Department, on_delete=models.CASCADE)
    
    def full_name(self):
        return f"{self.fName} {self.lName}"
    
    def __str__(self):
        return self.full_name()

class Dean(models.Model):
    userName = models.OneToOneField(Registration, on_delete=models.CASCADE, primary_key=True)
    fName = models.CharField(max_length=50)
    lName = models.CharField(max_length=50)
    mobile = models.CharField(max_length=15)
    deptID = models.ForeignKey(Department, on_delete=models.CASCADE)
    
    def full_name(self):
        return f"{self.fName} {self.lName}"
    
    def __str__(self):
        return self.full_name()

class Event(models.Model):
    CATEGORIES = [
        ('Athletic', 'Athletic'),
        ('Cultural', 'Cultural'),
        ('Academic', 'Academic'),
    ]
    
    eventID = models.AutoField(primary_key=True)
    category = models.CharField(max_length=20, choices=CATEGORIES)
    eventName = models.CharField(max_length=100)
    noOfParticipant = models.IntegerField()
    tournamentManager = models.ForeignKey(TournamentManager, on_delete=models.CASCADE)
    
    def __str__(self):
        return f"{self.eventName} ({self.category})"

class AthletesProfile(models.Model):
    GENDER = [
        ('Male', 'Male'),
        ('Female', 'Female'),
    ]
    
    CIVIL_STATUS = [
        ('Single', 'Single'),
        ('Married', 'Married'),
        ('Divorced', 'Divorced'),
        ('Widowed', 'Widowed'),
    ]
    
    idNum = models.OneToOneField(Registration, on_delete=models.CASCADE, primary_key=True)
    eventID = models.ForeignKey(Event, on_delete=models.CASCADE)
    deptID = models.ForeignKey(Department, on_delete=models.CASCADE)
    lastName = models.CharField(max_length=50)
    firstName = models.CharField(max_length=50)
    middleInit = models.CharField(max_length=5, blank=True)
    course = models.CharField(max_length=100)
    year = models.IntegerField()
    civilStatus = models.CharField(max_length=10, choices=CIVIL_STATUS)
    gender = models.CharField(max_length=10, choices=GENDER)
    birthdate = models.DateField()
    contactNo = models.CharField(max_length=15)
    address = models.TextField()
    coachID = models.ForeignKey(Coach, on_delete=models.CASCADE)
    deanID = models.ForeignKey(Dean, on_delete=models.CASCADE)
    
    # Approval fields
    coach_approved = models.BooleanField(default=False)
    dean_approved = models.BooleanField(default=False)
    admin_approved = models.BooleanField(default=False)
    
    def full_name(self):
        return f"{self.firstName} {self.lastName}"
    
    def __str__(self):
        return self.full_name()

from django import forms
from .models import *

class RegistrationForm(forms.ModelForm):
    class Meta:
        model = Registration
        fields = ['userName', 'password', 'confirmPassword', 'role']
        widgets = {
            'password': forms.PasswordInput(),
            'confirmPassword': forms.PasswordInput(),
        }

class LoginForm(forms.Form):
    userName = forms.CharField(max_length=50)
    password = forms.CharField(widget=forms.PasswordInput())

class DepartmentForm(forms.ModelForm):
    class Meta:
        model = Department
        fields = ['deptName']

class TournamentManagerForm(forms.ModelForm):
    class Meta:
        model = TournamentManager
        fields = ['userName', 'fName', 'lName', 'mobile', 'deptID']

class CoachForm(forms.ModelForm):
    class Meta:
        model = Coach
        fields = ['userName', 'fName', 'lName', 'mobile', 'deptID']

class DeanForm(forms.ModelForm):
    class Meta:
        model = Dean
        fields = ['userName', 'fName', 'lName', 'mobile', 'deptID']

class EventForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = ['category', 'eventName', 'noOfParticipant', 'tournamentManager']

class AthletesProfileForm(forms.ModelForm):
    class Meta:
        model = AthletesProfile
        fields = ['eventID', 'deptID', 'lastName', 'firstName', 'middleInit', 'course', 
                 'year', 'civilStatus', 'gender', 'birthdate', 'contactNo', 'address', 
                 'coachID', 'deanID']
        widgets = {
            'birthdate': forms.DateInput(attrs={'type': 'date'}),
        }

from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse
from .models import *
from .forms import *

# Registration UI
def registration_ui(request):
    return render(request, 'tournament/registration_ui.html')

def register_user(request):
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('registration_ui')
    else:
        form = RegistrationForm()
    return render(request, 'tournament/register.html', {'form': form})

def login_user(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            # Simple authentication (in real app, use Django's auth system)
            return redirect('registration_ui')
    else:
        form = LoginForm()
    return render(request, 'tournament/login.html', {'form': form})

# Department Management UI
def department_management(request):
    return render(request, 'tournament/department_management.html')

def create_department(request):
    if request.method == 'POST':
        form = DepartmentForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('department_management')
    else:
        form = DepartmentForm()
    return render(request, 'tournament/create_department.html', {'form': form})

# Tournament Manager UI
def tournament_manager_ui(request):
    return render(request, 'tournament/tournament_manager_ui.html')

def create_tournament_manager(request):
    if request.method == 'POST':
        form = TournamentManagerForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('tournament_manager_ui')
    else:
        form = TournamentManagerForm()
    return render(request, 'tournament/create_tournament_manager.html', {'form': form})

# Coach Management UI
def coach_management(request):
    return render(request, 'tournament/coach_management.html')

def create_coach(request):
    if request.method == 'POST':
        form = CoachForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('coach_management')
    else:
        form = CoachForm()
    return render(request, 'tournament/create_coach.html', {'form': form})

# Dean Management UI
def dean_management(request):
    return render(request, 'tournament/dean_management.html')

def create_dean(request):
    if request.method == 'POST':
        form = DeanForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('dean_management')
    else:
        form = DeanForm()
    return render(request, 'tournament/create_dean.html', {'form': form})

# Athlete's Management UI
def athlete_management(request):
    return render(request, 'tournament/athlete_management.html')

def create_athlete_profile(request):
    if request.method == 'POST':
        form = AthletesProfileForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('athlete_management')
    else:
        form = AthletesProfileForm()
    return render(request, 'tournament/create_athlete_profile.html', {'form': form})

def coach_approval(request):
    athletes = AthletesProfile.objects.all()
    athlete_id = request.GET.get('athlete_id')
    
    if request.method == 'POST' and athlete_id:
        athlete = get_object_or_404(AthletesProfile, idNum=athlete_id)
        athlete.coach_approved = True
        athlete.save()
        return redirect('coach_approval')
    
    return render(request, 'tournament/coach_approval.html', {'athletes': athletes})

def dean_approval(request):
    athletes = AthletesProfile.objects.all()
    athlete_id = request.GET.get('athlete_id')
    
    if request.method == 'POST' and athlete_id:
        athlete = get_object_or_404(AthletesProfile, idNum=athlete_id)
        athlete.dean_approved = True
        athlete.save()
        return redirect('dean_approval')
    
    return render(request, 'tournament/dean_approval.html', {'athletes': athletes})

def admin_approval(request):
    athletes = AthletesProfile.objects.all()
    athlete_id = request.GET.get('athlete_id')
    
    if request.method == 'POST' and athlete_id:
        athlete = get_object_or_404(AthletesProfile, idNum=athlete_id)
        athlete.admin_approved = True
        athlete.save()
        return redirect('admin_approval')
    
    return render(request, 'tournament/admin_approval.html', {'athletes': athletes})

# Event UI
def event_ui(request):
    return render(request, 'tournament/event_ui.html')

def create_event(request):
    if request.method == 'POST':
        form = EventForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('event_ui')
    else:
        form = EventForm()
    return render(request, 'tournament/create_event.html', {'form': form})

def update_event(request):
    events = Event.objects.all()
    event_id = request.GET.get('event_id')
    event = None
    
    if event_id:
        event = get_object_or_404(Event, eventID=event_id)
    
    if request.method == 'POST' and event:
        form = EventForm(request.POST, instance=event)
        if form.is_valid():
            form.save()
            return redirect('view_events')
    else:
        form = EventForm(instance=event) if event else None
    
    return render(request, 'tournament/update_event.html', {'events': events, 'event': event, 'form': form})

def delete_event(request):
    events = Event.objects.all()
    event_id = request.GET.get('event_id')
    event = None
    
    if event_id:
        event = get_object_or_404(Event, eventID=event_id)
    
    if request.method == 'POST' and event:
        event.delete()
        return redirect('view_events')
    
    return render(request, 'tournament/delete_event.html', {'events': events, 'event': event})

def view_events(request):
    events = Event.objects.all()
    
    # Count participants by gender for each event
    for event in events:
        event.male_count = AthletesProfile.objects.filter(eventID=event, gender='Male').count()
        event.female_count = AthletesProfile.objects.filter(eventID=event, gender='Female').count()
    
    return render(request, 'tournament/view_events.html', {'events': events})

from django.urls import path
from . import views

urlpatterns = [
    # Registration UI
    path('', views.registration_ui, name='registration_ui'),
    path('register/', views.register_user, name='register_user'),
    path('login/', views.login_user, name='login_user'),
    
    # Department Management
    path('departments/', views.department_management, name='department_management'),
    path('departments/create/', views.create_department, name='create_department'),
    
    # Tournament Manager
    path('tournament-managers/', views.tournament_manager_ui, name='tournament_manager_ui'),
    path('tournament-managers/create/', views.create_tournament_manager, name='create_tournament_manager'),
    
    # Coach Management
    path('coaches/', views.coach_management, name='coach_management'),
    path('coaches/create/', views.create_coach, name='create_coach'),
    
    # Dean Management
    path('deans/', views.dean_management, name='dean_management'),
    path('deans/create/', views.create_dean, name='create_dean'),
    
    # Athlete Management
    path('athletes/', views.athlete_management, name='athlete_management'),
    path('athletes/create/', views.create_athlete_profile, name='create_athlete_profile'),
    path('athletes/coach-approval/', views.coach_approval, name='coach_approval'),
    path('athletes/dean-approval/', views.dean_approval, name='dean_approval'),
    path('athletes/admin-approval/', views.admin_approval, name='admin_approval'),
    
    # Event Management
    path('events/', views.event_ui, name='event_ui'),
    path('events/create/', views.create_event, name='create_event'),
    path('events/update/', views.update_event, name='update_event'),
    path('events/delete/', views.delete_event, name='delete_event'),
    path('events/view/', views.view_events, name='view_events'),
]

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('intrams.urls')),
]

# base.html

<!DOCTYPE html>
<html>
<head>
    <title>Tournament Management System</title>
</head>
<body>
    <h1>Tournament Management System</h1>
    <nav>
        <a href="{% url 'registration_ui' %}">Registration</a> |
        <a href="{% url 'department_management' %}">Departments</a> |
        <a href="{% url 'tournament_manager_ui' %}">Tournament Managers</a> |
        <a href="{% url 'coach_management' %}">Coaches</a> |
        <a href="{% url 'dean_management' %}">Deans</a> |
        <a href="{% url 'athlete_management' %}">Athletes</a> |
        <a href="{% url 'event_ui' %}">Events</a>
    </nav>
    <hr>
    {% block content %}
    {% endblock %}
</body>
</html>

# admin_approval.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Admin Approval</h2>

{% if athletes %}
<table border="1">
    <tr>
        <th>Athlete ID</th>
        <th>Name</th>
        <th>Event</th>
        <th>Status</th>
        <th>Action</th>
    </tr>
    {% for athlete in athletes %}
    <tr>
        <td>{{ athlete.idNum }}</td>
        <td>{{ athlete.full_name }}</td>
        <td>{{ athlete.eventID.eventName }}</td>
        <td>
            {% if athlete.admin_approved %}
                Approved
            {% else %}
                Pending
            {% endif %}
        </td>
        <td>
            {% if not athlete.admin_approved %}
            <form method="post" style="display: inline;">
                {% csrf_token %}
                <input type="hidden" name="athlete_id" value="{{ athlete.idNum }}">
                <button type="submit">Approve</button>
            </form>
            {% else %}
            Approved
            {% endif %}
        </td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No athlete profiles found.</p>
{% endif %}

<a href="{% url 'athlete_management' %}">← Back to Athlete Management</a>
{% endblock %}

# athlete_management.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Athlete's Management UI</h2>
<ul>
    <li><a href="{% url 'create_athlete_profile' %}">1. Student to fillup and submit the athlete's profile</a></li>
    <li><a href="{% url 'coach_approval' %}">2. Coach to approve/disapprove the athlete's profile</a></li>
    <li><a href="{% url 'dean_approval' %}">3. Dean to approve/disapprove the athlete's profile</a></li>
    <li><a href="{% url 'admin_approval' %}">4. Admin to approve/disapprove the athlete's profile</a></li>
</ul>
{% endblock %}

# coach_approval.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Coach Approval</h2>

{% if athletes %}
<table border="1">
    <tr>
        <th>Athlete ID</th>
        <th>Name</th>
        <th>Event</th>
        <th>Status</th>
        <th>Action</th>
    </tr>
    {% for athlete in athletes %}
    <tr>
        <td>{{ athlete.idNum }}</td>
        <td>{{ athlete.full_name }}</td>
        <td>{{ athlete.eventID.eventName }}</td>
        <td>
            {% if athlete.coach_approved %}
                Approved
            {% else %}
                Pending
            {% endif %}
        </td>
        <td>
            {% if not athlete.coach_approved %}
            <form method="post" style="display: inline;">
                {% csrf_token %}
                <input type="hidden" name="athlete_id" value="{{ athlete.idNum }}">
                <button type="submit">Approve</button>
            </form>
            {% else %}
            Approved
            {% endif %}
        </td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No athlete profiles found.</p>
{% endif %}

<a href="{% url 'athlete_management' %}">← Back to Athlete Management</a>
{% endblock %}

# coach_management.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Coach Management UI</h2>
<ul>
    <li><a href="{% url 'create_coach' %}">1. Create the necessary data</a></li>
</ul>
{% endblock %}

# create_athlete_profile.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Create Athlete Profile</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Submit Profile</button>
</form>
<a href="{% url 'athlete_management' %}">← Back to Athlete Management</a>
{% endblock %}

# create_coach.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Create Coach</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Create Coach</button>
</form>
<a href="{% url 'coach_management' %}">← Back to Coach Management</a>
{% endblock %}

# create_dean.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Create Dean</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Create Dean</button>
</form>
<a href="{% url 'dean_management' %}">← Back to Dean Management</a>
{% endblock %}

# create_department.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Create Department</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Create Department</button>
</form>
<a href="{% url 'department_management' %}">← Back to Department Management</a>
{% endblock %}

# create_event.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Create Event</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Create Event</button>
</form>
<a href="{% url 'event_ui' %}">← Back to Events</a>
{% endblock %}

# create_tournament_manager.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Create Tournament Manager</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Create Tournament Manager</button>
</form>
<a href="{% url 'tournament_manager_ui' %}">← Back to Tournament Manager</a>
{% endblock %}

# dean_approval.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Dean Approval</h2>

{% if athletes %}
<table border="1">
    <tr>
        <th>Athlete ID</th>
        <th>Name</th>
        <th>Event</th>
        <th>Status</th>
        <th>Action</th>
    </tr>
    {% for athlete in athletes %}
    <tr>
        <td>{{ athlete.idNum }}</td>
        <td>{{ athlete.full_name }}</td>
        <td>{{ athlete.eventID.eventName }}</td>
        <td>
            {% if athlete.dean_approved %}
                Approved
            {% else %}
                Pending
            {% endif %}
        </td>
        <td>
            {% if not athlete.dean_approved %}
            <form method="post" style="display: inline;">
                {% csrf_token %}
                <input type="hidden" name="athlete_id" value="{{ athlete.idNum }}">
                <button type="submit">Approve</button>
            </form>
            {% else %}
            Approved
            {% endif %}
        </td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No athlete profiles found.</p>
{% endif %}

<a href="{% url 'athlete_management' %}">← Back to Athlete Management</a>
{% endblock %}

# dean_management.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Dean Management UI</h2>
<ul>
    <li><a href="{% url 'create_dean' %}">1. Create the necessary data</a></li>
</ul>
{% endblock %}

# delete_event.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Delete Event</h2>

<form method="get">
    <label>Search Event by ID:</label>
    <input type="number" name="event_id" value="{{ request.GET.event_id }}">
    <button type="submit">Search</button>
</form>

{% if event %}
    <h3>Delete Event: {{ event.eventName }}</h3>
    <p>Are you sure you want to delete "{{ event.eventName }}"?</p>
    <form method="post">
        {% csrf_token %}
        <button type="submit" style="color: red;">Confirm Delete</button>
    </form>
{% elif request.GET.event_id %}
    <p style="color: red;">No event found with ID {{ request.GET.event_id }}</p>
{% endif %}

<h3>Available Events:</h3>
{% if events %}
<table border="1">
    <tr>
        <th>Event ID</th>
        <th>Event Name</th>
        <th>Category</th>
        <th>Participants</th>
    </tr>
    {% for ev in events %}
    <tr>
        <td>{{ ev.eventID }}</td>
        <td>{{ ev.eventName }}</td>
        <td>{{ ev.category }}</td>
        <td>{{ ev.noOfParticipant }}</td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No events available.</p>
{% endif %}

<a href="{% url 'event_ui' %}">← Back to Events</a>
{% endblock %}

# department_management.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Department Management UI</h2>
<ul>
    <li><a href="{% url 'create_department' %}">1. Create Department Data</a></li>
</ul>
{% endblock %}

# event_ui.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Event UI</h2>
<ul>
    <li><a href="{% url 'create_event' %}">1. Create necessary data</a></li>
    <li><a href="{% url 'update_event' %}">2. Update the data</a></li>
    <li><a href="{% url 'delete_event' %}">3. Delete the data</a></li>
    <li><a href="{% url 'view_events' %}">4. Read the data</a></li>
</ul>
{% endblock %}

# login.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>User Login</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Login</button>
</form>
<a href="{% url 'registration_ui' %}">← Back to Registration</a>
{% endblock %}

# register.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>User Registration</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Register</button>
</form>
<a href="{% url 'registration_ui' %}">← Back to Registration</a>
{% endblock %}

# registration_ui.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Registration UI</h2>
<ul>
    <li><a href="{% url 'register_user' %}">1. Admin/Student/Coach/Tournament manager/dean to register</a></li>
    <li><a href="{% url 'login_user' %}">2. Admin/Student/Coach/Tournament manager/dean to login</a></li>
</ul>
{% endblock %}

# tournament_manager_ui.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Tournament Manager UI</h2>
<ul>
    <li><a href="{% url 'create_tournament_manager' %}">1. Create necessary data</a></li>
</ul>
{% endblock %}

# update_event.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Update Event</h2>

<form method="get">
    <label>Search Event by ID:</label>
    <input type="number" name="event_id" value="{{ request.GET.event_id }}">
    <button type="submit">Search</button>
</form>

{% if event %}
    <h3>Update Event: {{ event.eventName }}</h3>
    <form method="post">
        {% csrf_token %}
        {{ form.as_p }}
        <button type="submit">Update Event</button>
    </form>
{% elif request.GET.event_id %}
    <p style="color: red;">No event found with ID {{ request.GET.event_id }}</p>
{% endif %}

<h3>Available Events:</h3>
{% if events %}
<table border="1">
    <tr>
        <th>Event ID</th>
        <th>Event Name</th>
        <th>Category</th>
        <th>Participants</th>
    </tr>
    {% for ev in events %}
    <tr>
        <td>{{ ev.eventID }}</td>
        <td>{{ ev.eventName }}</td>
        <td>{{ ev.category }}</td>
        <td>{{ ev.noOfParticipant }}</td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No events available.</p>
{% endif %}

<a href="{% url 'event_ui' %}">← Back to Events</a>
{% endblock %}

# view_events.html

{% extends 'tournament/base.html' %}

{% block content %}
<h2>Events</h2>

<h3>Athletic Events</h3>
{% for event in events %}
    {% if event.category == 'Athletic' %}
    <table border="1">
        <tr>
            <th>Event</th>
            <th>Number Of Participants</th>
            <th>Tournament Manager</th>
        </tr>
        <tr>
            <td>{{ event.eventName }}</td>
            <td>
                Total: {{ event.noOfParticipant }}<br>
                Men: {{ event.male_count }}<br>
                Women: {{ event.female_count }}
            </td>
            <td>{{ event.tournamentManager.full_name }}</td>
        </tr>
    </table>
    <br>
    {% endif %}
{% endfor %}

<h3>Cultural Events</h3>
{% for event in events %}
    {% if event.category == 'Cultural' %}
    <table border="1">
        <tr>
            <th>Event</th>
            <th>Number Of Participants</th>
            <th>Tournament Manager</th>
        </tr>
        <tr>
            <td>{{ event.eventName }}</td>
            <td>
                Total: {{ event.noOfParticipant }}<br>
                Men: {{ event.male_count }}<br>
                Women: {{ event.female_count }}
            </td>
            <td>{{ event.tournamentManager.full_name }}</td>
        </tr>
    </table>
    <br>
    {% endif %}
{% endfor %}

<h3>Academic Events</h3>
{% for event in events %}
    {% if event.category == 'Academic' %}
    <table border="1">
        <tr>
            <th>Event</th>
            <th>Number Of Participants</th>
            <th>Tournament Manager</th>
        </tr>
        <tr>
            <td>{{ event.eventName }}</td>
            <td>
                Total: {{ event.noOfParticipant }}<br>
                Men: {{ event.male_count }}<br>
                Women: {{ event.female_count }}
            </td>
            <td>{{ event.tournamentManager.full_name }}</td>
        </tr>
    </table>
    <br>
    {% endif %}
{% endfor %}

<a href="{% url 'event_ui' %}">← Back to Events</a>
{% endblock %}
