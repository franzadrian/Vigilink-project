from django.db import models

class Events(models.Model):
    evCode = models.AutoField(primary_key=True)
    evName = models.CharField(max_length=100)
    evDate = models.DateField()
    evVenue = models.CharField(max_length=100)
    evRFee = models.DecimalField(max_digits=10, decimal_places=2)
    
    def __str__(self):
        return f"{self.evName} ({self.evCode})"

class Participants(models.Model):
    partID = models.AutoField(primary_key=True)
    evCode = models.ForeignKey(Events, on_delete=models.CASCADE)
    partFName = models.CharField(max_length=50)
    partLName = models.CharField(max_length=50)
    partDRate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    def full_name(self):
        return f"{self.partFName} {self.partLName}"
    
    def __str__(self):
        return f"{self.partFName} {self.partLName} ({self.partID})"

class Registration(models.Model):
    PAYMENT_MODES = [
        ('Card', 'Card'),
        ('Cash', 'Cash'),
    ]
    
    regCode = models.AutoField(primary_key=True)
    partID = models.ForeignKey(Participants, on_delete=models.CASCADE)
    regDate = models.DateField()
    regFPaid = models.DecimalField(max_digits=10, decimal_places=2)
    regPMode = models.CharField(max_length=10, choices=PAYMENT_MODES)
    
    def __str__(self):
        return f"Registration {self.regCode}"

from django import forms
from .models import Events, Participants, Registration

class EventForm(forms.ModelForm):
    class Meta:
        model = Events
        fields = ['evName', 'evDate', 'evVenue', 'evRFee']
        widgets = {
            'evDate': forms.DateInput(attrs={'type': 'date'}),
        }

class ParticipantForm(forms.ModelForm):
    class Meta:
        model = Participants
        fields = ['evCode', 'partFName', 'partLName', 'partDRate']

class RegistrationForm(forms.ModelForm):
    class Meta:
        model = Registration
        fields = ['partID', 'regDate', 'regPMode']
        widgets = {
            'regDate': forms.DateInput(attrs={'type': 'date'}),
        }
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Count, Sum, F
from .models import Events, Participants, Registration
from .forms import EventForm, ParticipantForm, RegistrationForm

def events_management(request):
    return render(request, 'events_management.html')

def add_event(request):
    if request.method == 'POST':
        form = EventForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('view_events')
    else:
        form = EventForm()
    return render(request, 'add_event.html', {'form': form})

def search_update_event(request):
    events = Events.objects.all()
    event_id = request.GET.get('event_id')
    event = None
    if event_id:
        event = get_object_or_404(Events, evCode=event_id)
    
    if request.method == 'POST' and event:
        form = EventForm(request.POST, instance=event)
        if form.is_valid():
            form.save()
            return redirect('view_events')
    else:
        form = EventForm(instance=event) if event else None
    
    return render(request, 'search_update_event.html', {
        'events': events,
        'event': event,
        'form': form
    })

def search_delete_event(request):
    events = Events.objects.all()
    event_id = request.GET.get('event_id')
    event = None
    if event_id:
        event = get_object_or_404(Events, evCode=event_id)
    
    if request.method == 'POST' and event:
        event.delete()
        return redirect('view_events')
    
    return render(request, 'search_delete_event.html', {
        'events': events,
        'event': event
    })

def view_events(request):
    events = Events.objects.all()
    return render(request, 'view_events.html', {'events': events})

def participants_management(request):
    return render(request, 'participants_management.html')

def add_participant(request):
    if request.method == 'POST':
        form = ParticipantForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('view_participants')
    else:
        form = ParticipantForm()
    return render(request, 'add_participant.html', {'form': form})

def search_update_participant(request):
    participants = Participants.objects.all()
    participant_id = request.GET.get('participant_id')
    participant = None
    if participant_id:
        participant = get_object_or_404(Participants, partID=participant_id)
    
    if request.method == 'POST' and participant:
        form = ParticipantForm(request.POST, instance=participant)
        if form.is_valid():
            form.save()
            return redirect('view_participants')
    else:
        form = ParticipantForm(instance=participant) if participant else None
    
    return render(request, 'search_update_participant.html', {
        'participants': participants,
        'participant': participant,
        'form': form
    })

def search_delete_participant(request):
    participants = Participants.objects.all()
    participant_id = request.GET.get('participant_id')
    participant = None
    if participant_id:
        participant = get_object_or_404(Participants, partID=participant_id)
    
    if request.method == 'POST' and participant:
        participant.delete()
        return redirect('view_participants')
    
    return render(request, 'search_delete_participant.html', {
        'participants': participants,
        'participant': participant
    })

def view_participants(request):
    participants = Participants.objects.all()
    return render(request, 'view_participants.html', {'participants': participants})

def participants_registration(request):
    return render(request, 'participants_registration.html')

def register_participant(request):
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            registration = form.save(commit=False)

            participant = registration.partID
            event_fee = participant.evCode.evRFee
            discount = participant.partDRate
            registration.regFPaid = event_fee - discount
            registration.save()
            return redirect('view_registrations')
    else:
        form = RegistrationForm()
    
    return render(request, 'register_participant.html', {'form': form})

def compute_fee(request):
    participant_id = request.GET.get('participant_id')
    calculated_fee = None
    participant = None
    
    if participant_id:
        participant = get_object_or_404(Participants, partID=participant_id)
        event_fee = participant.evCode.evRFee
        discount = participant.partDRate
        calculated_fee = event_fee - discount
    
    participants = Participants.objects.all()
    return render(request, 'compute_fee.html', {
        'participants': participants,
        'participant': participant,
        'calculated_fee': calculated_fee
    })

def view_registrations(request):
    registrations = Registration.objects.all().order_by('-regDate')
    return render(request, 'view_registrations.html', {'registrations': registrations})

def registration_monitoring(request):
    event_name = request.GET.get('event_name', '')
    registrations = Registration.objects.all()
    summary = None
    
    if event_name:
        registrations = registrations.filter(partID__evCode__evName__icontains=event_name)
        
        record_count = registrations.count()
        total_fees_paid = registrations.aggregate(Sum('regFPaid'))['regFPaid__sum'] or 0
        event_fee = registrations.first().partID.evCode.evRFee if registrations.exists() else 0
        total_discounts = (record_count * event_fee) - total_fees_paid
        
        summary = {
            'record_count': record_count,
            'total_fees_paid': total_fees_paid,
            'total_discounts': total_discounts
        }
    
    events = Events.objects.all()
    return render(request, 'registration_monitoring.html', {
        'registrations': registrations,
        'events': events,
        'selected_event': event_name,
        'summary': summary
    })

# event/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.events_management, name='home'),  # Root URL for your app
    
    # Events Management
    path('events/', views.events_management, name='events_management'),
    path('events/add/', views.add_event, name='add_event'),
    path('events/search-update/', views.search_update_event, name='search_update_event'),
    path('events/search-delete/', views.search_delete_event, name='search_delete_event'),
    path('events/view/', views.view_events, name='view_events'),
    
    # Participants Management
    path('participants/', views.participants_management, name='participants_management'),
    path('participants/add/', views.add_participant, name='add_participant'),
    path('participants/search-update/', views.search_update_participant, name='search_update_participant'),
    path('participants/search-delete/', views.search_delete_participant, name='search_delete_participant'),
    path('participants/view/', views.view_participants, name='view_participants'),
    
    # Participants Registration
    path('registration/', views.participants_registration, name='participants_registration'),
    path('registration/register/', views.register_participant, name='register_participant'),
    path('registration/compute-fee/', views.compute_fee, name='compute_fee'),
    path('registration/view/', views.view_registrations, name='view_registrations'),
    
    # Events Registration Monitoring
    path('monitoring/', views.registration_monitoring, name='registration_monitoring'),
]

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('event.urls'))
]

# add_event.html

{% extends 'base.html' %}

{% block content %}
<h2>Add Event Record</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Add Event</button>
</form>
<a href="{% url 'events_management' %}">Back to Events Management</a>
{% endblock %}

# add_participant.html

{% extends 'base.html' %}

{% block content %}
<h2>Add Participant Record</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Add Participant</button>
</form>
<a href="{% url 'participants_management' %}">Back to Participants Management</a>
{% endblock %}

# base.html

<!DOCTYPE html>
<html>
<head>
    <title>Events Registration System</title>
</head>
<body>
    <h1>Events Registration System</h1>
    <nav>
        <a href="{% url 'home' %}">Home</a> |
        <a href="{% url 'events_management' %}">Events</a> |
        <a href="{% url 'participants_management' %}">Participants</a> |
        <a href="{% url 'participants_registration' %}">Registration</a> |
        <a href="{% url 'registration_monitoring' %}">Monitoring</a>
    </nav>
    <hr>
    {% block content %}
    {% endblock %}
</body>
</html>

# compute_fee.html

{% extends 'base.html' %}

{% block content %}
<h2>Compute Registration Fee</h2>

<form method="get">
    <label>Select Participant:</label>
    <select name="participant_id">
        <option value="">Select Participant</option>
        {% for participant in participants %}
        <option value="{{ participant.partID }}" {% if participant.partID == participant.partID %}selected{% endif %}>
            {{ participant.full_name }} - {{ participant.evCode.evName }}
        </option>
        {% endfor %}
    </select>
    <button type="submit">Calculate Fee</button>
</form>

{% if calculated_fee is not None %}
    <h3>Fee Calculation for {{ participant.full_name }}</h3>
    <p>Event: {{ participant.evCode.evName }}</p>
    <p>Event Fee: {{ participant.evCode.evRFee }}</p>
    <p>Discount Rate: {{ participant.partDRate }}</p>
    <p><strong>Final Fee to Pay: {{ calculated_fee }}</strong></p>
{% endif %}

<a href="{% url 'participants_registration' %}">Back to Registration</a>
{% endblock %}

# events_management.html

{% extends 'base.html' %}

{% block content %}
<h2>Events Management UI</h2>
<ul>
    <li><a href="{% url 'add_event' %}">1. Adding an Event Record</a></li>
    <li><a href="{% url 'search_update_event' %}">2. Searching - Updating an Event Record</a></li>
    <li><a href="{% url 'search_delete_event' %}">3. Searching - Deleting an Event Record</a></li>
    <li><a href="{% url 'view_events' %}">4. Viewing of Event Records</a></li>
</ul>
{% endblock %}

# participants_management.html

{% extends 'base.html' %}

{% block content %}
<h2>Participants Management UI</h2>
<ul>
    <li><a href="{% url 'add_participant' %}">1. Adding a Participant record</a></li>
    <li><a href="{% url 'search_update_participant' %}">2. Searching - Updating a Participant record</a></li>
    <li><a href="{% url 'search_delete_participant' %}">3. Searching - Deleting a Participant record</a></li>
    <li><a href="{% url 'view_participants' %}">4. Viewing of Participant records</a></li>
</ul>
{% endblock %}

# participants_registration.html

{% extends 'base.html' %}

{% block content %}
<h2>Participants Registration UI</h2>
<ul>
    <li><a href="{% url 'register_participant' %}">1. Registering of a Participant to an event</a></li>
    <li><a href="{% url 'compute_fee' %}">2. Computing for the Participants registration fee to be paid after applying discount rate</a></li>
    <li><a href="{% url 'view_registrations' %}">3. Viewing of Registration Transaction records arranged from latest to oldest</a></li>
</ul>
{% endblock %}

# register_participant.html

{% extends 'base.html' %}

{% block content %}
<h2>Register Participant</h2>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Register</button>
</form>
<a href="{% url 'participants_registration' %}">Back to Registration</a>
{% endblock %}

# registration_monitoring.html

{% extends 'base.html' %}

{% block content %}
<h2>Events Registration Monitoring UI</h2>

<form method="get">
    <label>Filter by Event's Name:</label>
    <select name="event_name">
        <option value="">All Events</option>
        {% for event in events %}
        <option value="{{ event.evName }}" {% if event.evName == selected_event %}selected{% endif %}>
            {{ event.evName }}
        </option>
        {% endfor %}
    </select>
    <button type="submit">Filter</button>
</form>

{% if registrations %}
    <h3>Registration Records</h3>
    <table border="1">
        <tr>
            <th>Event's Name</th>
            <th>Participant's Full Name</th>
            <th>Registration Date</th>
            <th>Registration Fee Paid</th>
        </tr>
        {% for reg in registrations %}
        <tr>
            <td>{{ reg.partID.evCode.evName }}</td>
            <td>{{ reg.partID.full_name }}</td>
            <td>{{ reg.regDate }}</td>
            <td>{{ reg.regFPaid }}</td>
        </tr>
        {% endfor %}
    </table>

    {% if summary %}
    <h3>Summary</h3>
    <p>Number of Records: {{ summary.record_count }}</p>
    <p>Total Registration Fees Paid: {{ summary.total_fees_paid }}</p>
    <p>Total Amount of Discounts: {{ summary.total_discounts }}</p>
    {% endif %}
{% else %}
    <p>No registration records found.</p>
{% endif %}
{% endblock %}

# search_delete_event.html

{% extends 'base.html' %}

{% block content %}
<h2>Search and Delete Event Record</h2>

<form method="get">
    <label>Search Event by ID:</label>
    <input type="number" name="event_id" value="{{ request.GET.event_id }}">
    <button type="submit">Search</button>
</form>

{% if event %}
    <h3>Delete Event: {{ event.evName }}</h3>
    <p>Are you sure you want to delete "{{ event.evName }}"?</p>
    <form method="post">
        {% csrf_token %}
        <button type="submit">Confirm Delete</button>
    </form>
{% elif request.GET.event_id %}
    <p>No event found with ID {{ request.GET.event_id }}</p>
{% endif %}

<h3>All Events</h3>
<ul>
{% for event in events %}
    <li>{{ event.evCode }}: {{ event.evName }} ({{ event.evDate }})</li>
{% endfor %}
</ul>

<a href="{% url 'events_management' %}">Back to Events Management</a>
{% endblock %}

# search_delete_participant.html

{% extends 'base.html' %}

{% block content %}
<h2>Search and Delete Participant Record</h2>

<form method="get">
    <label>Search Participant by ID:</label>
    <input type="number" name="participant_id" value="{{ request.GET.participant_id }}">
    <button type="submit">Search</button>
</form>

{% if participant %}
    <h3>Delete Participant: {{ participant.full_name }}</h3>
    <p>Are you sure you want to delete "{{ participant.full_name }}"?</p>
    <form method="post">
        {% csrf_token %}
        <button type="submit">Confirm Delete</button>
    </form>
{% elif request.GET.participant_id %}
    <p>No participant found with ID {{ request.GET.participant_id }}</p>
{% endif %}

<h3>All Participants</h3>
<ul>
{% for participant in participants %}
    <li>{{ participant.partID }}: {{ participant.full_name }} - {{ participant.evCode.evName }}</li>
{% endfor %}
</ul>

<a href="{% url 'participants_management' %}">Back to Participants Management</a>
{% endblock %}

# search_update_event.html

{% extends 'base.html' %}

{% block content %}
<h2>Search and Update Event Record</h2>

<form method="get">
    <label>Search Event by ID:</label>
    <input type="number" name="event_id" value="{{ request.GET.event_id }}">
    <button type="submit">Search</button>
</form>

{% if event %}
    <h3>Update Event: {{ event.evName }}</h3>
    <form method="post">
        {% csrf_token %}
        {{ form.as_p }}
        <button type="submit">Update Event</button>
    </form>
{% elif request.GET.event_id %}
    <p>No event found with ID {{ request.GET.event_id }}</p>
{% endif %}

<h3>All Events</h3>
<ul>
{% for event in events %}
    <li>{{ event.evCode }}: {{ event.evName }} ({{ event.evDate }})</li>
{% endfor %}
</ul>

<a href="{% url 'events_management' %}">Back to Events Management</a>
{% endblock %}

# search_update_participant.html

{% extends 'base.html' %}

{% block content %}
<h2>Search and Update Participant Record</h2>

<form method="get">
    <label>Search Participant by ID:</label>
    <input type="number" name="participant_id" value="{{ request.GET.participant_id }}">
    <button type="submit">Search</button>
</form>

{% if participant %}
    <h3>Update Participant: {{ participant.full_name }}</h3>
    <form method="post">
        {% csrf_token %}
        {{ form.as_p }}
        <button type="submit">Update Participant</button>
    </form>
{% elif request.GET.participant_id %}
    <p style="color: red;">No participant found with ID {{ request.GET.participant_id }}</p>
{% endif %}

<h3>All Participants (for reference):</h3>
{% if participants %}
<table border="1">
    <tr>
        <th>Participant ID</th>
        <th>Full Name</th>
        <th>Event</th>
        <th>Discount Rate</th>
    </tr>
    {% for part in participants %}
    <tr>
        <td>{{ part.partID }}</td>
        <td>{{ part.full_name }}</td>
        <td>{{ part.evCode.evName }}</td>
        <td>{{ part.partDRate }}</td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No participants available. <a href="{% url 'add_participant' %}">Add a participant first</a>.</p>
{% endif %}

<a href="{% url 'participants_management' %}">Back to Participants Management</a>
{% endblock %}

# view_events.html

{% extends 'base.html' %}

{% block content %}
<h2>Event Records</h2>
{% if events %}
<table border="1">
    <tr>
        <th>Event Code</th>
        <th>Event Name</th>
        <th>Event Date</th>
        <th>Venue</th>
        <th>Registration Fee</th>
    </tr>
    {% for event in events %}
    <tr>
        <td>{{ event.evCode }}</td>
        <td>{{ event.evName }}</td>
        <td>{{ event.evDate }}</td>
        <td>{{ event.evVenue }}</td>
        <td>{{ event.evRFee }}</td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No events found.</p>
{% endif %}
<a href="{% url 'events_management' %}">Back to Events Management</a>
{% endblock %}

# view_participants.html

{% extends 'base.html' %}

{% block content %}
<h2>Participant Records</h2>
{% if participants %}
<table border="1">
    <tr>
        <th>Participant ID</th>
        <th>Full Name</th>
        <th>Event</th>
        <th>Discount Rate</th>
    </tr>
    {% for participant in participants %}
    <tr>
        <td>{{ participant.partID }}</td>
        <td>{{ participant.full_name }}</td>
        <td>{{ participant.evCode.evName }}</td>
        <td>{{ participant.partDRate }}</td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No participants found.</p>
{% endif %}
<a href="{% url 'participants_management' %}">Back to Participants Management</a>
{% endblock %}

# view_registrations.html

{% extends 'base.html' %}

{% block content %}
<h2>Registration Records (Latest to Oldest)</h2>
{% if registrations %}
<table border="1">
    <tr>
        <th>Registration Code</th>
        <th>Participant</th>
        <th>Event</th>
        <th>Registration Date</th>
        <th>Fee Paid</th>
        <th>Payment Mode</th>
    </tr>
    {% for reg in registrations %}
    <tr>
        <td>{{ reg.regCode }}</td>
        <td>{{ reg.partID.full_name }}</td>
        <td>{{ reg.partID.evCode.evName }}</td>
        <td>{{ reg.regDate }}</td>
        <td>${{ reg.regFPaid }}</td>
        <td>{{ reg.regPMode }}</td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No registration records found.</p>
{% endif %}
<br>
<a href="{% url 'participants_registration' %}">← Back to Registration</a>
{% endblock %}


