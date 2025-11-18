from django.db import models

# Create your models here.

class PetOwner(models.Model):
    petOwnerFName = models.CharField(max_length=50)
    petOwnerLName = models.CharField(max_length=50)
    petOwnerBDate = models.DateField()
    petOwnerTelNo = models.CharField(max_length=15)

    def __str__(self):
        return f'{self.petOwnerFName} {self.petOwnerLName}'
    
class Veterinarian(models.Model):
    vetFName = models.CharField(max_length=50)
    vetLName = models.CharField(max_length=50)
    vetAddress = models.CharField(max_length=100)
    vetSpecial = models.CharField(max_length=50)

    def __str__(self):
        return f'{self.vetFName} {self.vetLName}'
    
class PetType(models.TextChoices):
    DOG = 'Dog', 'dog'
    CAT = 'Cat', 'cat'
    FISH = 'Fish', 'fish'
    BIRD = 'Bird', 'Bird'

class Pet(models.Model):
    petName = models.CharField(max_length=50)
    petType = models.CharField(max_length=50, choices = PetType.choices)
    petBreed = models.CharField(max_length=50)
    petBDate = models.DateField(max_length=50)
    petOwnerID = models.ForeignKey(PetOwner, on_delete=models.CASCADE)

    def __str__(self):
        return f'{self.petName} {self.petType}'

class Consultation(models.Model):
    petID = models.ForeignKey(Pet, on_delete=models.CASCADE)
    vetID = models.ForeignKey(Veterinarian, on_delete=models.CASCADE)
    consultDate = models.DateTimeField()
    diagnoses = models.TextField()
    prescription = models.TextField()

from django import forms
from .models import PetOwner, Veterinarian, Pet, Consultation

class PetOwnerForm(forms.ModelForm):
    petOwnerBDate = forms.DateField(label="Birth Date", widget=forms.DateInput(attrs={'type': 'date'}))

    class Meta:
        model = PetOwner
        fields = ['petOwnerFName', 'petOwnerLName', 'petOwnerBDate', 'petOwnerTelNo']

class VeterinarianForm(forms.ModelForm):
    class Meta:
        model = Veterinarian
        fields = ['vetFName', 'vetLName', 'vetAddress', 'vetSpecial']

class PetForm(forms.ModelForm):
    petBDate = forms.DateField(label="Birth Date", widget=forms.DateInput(attrs={'type': 'date'}))

    class Meta:
        model = Pet
        fields = ['petName', 'petType', 'petBreed', 'petBDate', 'petOwnerID']

class ConsultationForm(forms.ModelForm):
    consultDate = forms.DateTimeField(widget=forms.DateTimeInput(attrs={'type': 'datetime-local'}))

    class Meta:
        model = Consultation
        fields = ['petID', 'vetID', 'consultDate', 'diagnoses', 'prescription']


from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),

    path('petowners/', views.petowner_list, name='petowner_list'),
    path('petowners/create/', views.petowner_create, name='petowner_create'),
    path('petowners/update/<int:id>/', views.petowner_update, name='petowner_update'),
    path('petowners/delete/<int:id>/', views.petowner_delete, name='petowner_delete'),

    path('vets/', views.vet_list, name='vet_list'),
    path('vets/create/', views.vet_create, name='vet_create'),
    path('vets/update/<int:id>/', views.vet_update, name='vet_update'),
    path('vets/delete/<int:id>/', views.vet_delete, name='vet_delete'),

    path('pets/', views.pet_list, name='pet_list'),
    path('pets/create/', views.pet_create, name='pet_create'),
    path('pets/update/<int:id>/', views.pet_update, name='pet_update'),
    path('pets/delete/<int:id>/', views.pet_delete, name='pet_delete'),

    path('consults/', views.consult_list, name='consult_list'),
    path('consults/create/', views.consult_create, name='consult_create'),
    path('consults/update/<int:id>/', views.consult_update, name='consult_update'),
    path('consults/delete/<int:id>/', views.consult_delete, name='consult_delete'),

    path('consults/inquiry/', views.consult_inquiry, name='consult_inquiry')
]

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('clinic.urls')),
]

from django.shortcuts import render, redirect, get_object_or_404
from .models import PetOwner, Veterinarian, Pet, Consultation
from .forms import PetOwnerForm, VeterinarianForm, PetForm, ConsultationForm
from django.db.models import Count, Q

def home(request):
    return render(request, 'home.html')

def petowner_list(request):
    query = request.GET.get('q')
    if query:
        petowners = PetOwner.objects.filter(
            Q(id__icontains=query) |
            Q(petOwnerFName__icontains=query) |
            Q(petOwnerLName__icontains=query)
        )
    else:
        petowners = PetOwner.objects.all()
    return render(request, 'petowner/petowner_list.html', {'petowners': petowners})

def petowner_create(request):
    form = PetOwnerForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('petowner_list')
    return render(request, 'petowner/petowner_form.html', {'form': form})

def petowner_update(request, id):
    petowner = get_object_or_404(PetOwner, id=id)
    form = PetOwnerForm(request.POST or None, instance=petowner)
    if form.is_valid():
        form.save()
        return redirect('petowner_list')
    return render(request, 'petowner/petowner_form.html', {'form': form})

def petowner_delete(request, id):
    petowner = get_object_or_404(PetOwner, id=id)
    if request.method == "POST":
        petowner.delete()
        return redirect('petowner_list')
    return render(request, 'petowner/petowner_delete.html', {'petowner': petowner})

def vet_list(request):
    query = request.GET.get('q')
    if query:
        vets = Veterinarian.objects.filter(
            Q(id__icontains=query) |
            Q(vetFName__icontains=query) |
            Q(vetLName__icontains=query)
        )
    else:
        vets = Veterinarian.objects.all()
    return render(request, 'vet/vet_list.html', {'vets': vets})

def vet_create(request):
    form = VeterinarianForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('vet_list')
    return render(request, 'vet/vet_form.html', {'form': form})

def vet_update(request, id):
    vet = get_object_or_404(Veterinarian, id=id)
    form = VeterinarianForm(request.POST or None, instance=vet)
    if form.is_valid():
        form.save()
        return redirect('vet_list')
    return render(request, 'vet/vet_form.html', {'form': form})

def vet_delete(request, id):
    vet = get_object_or_404(Veterinarian, id=id)
    if request.method == "POST":
        vet.delete()
        return redirect('vet_list')
    return render(request, 'vet/vet_delete.html', {'vet': vet})

def pet_list(request):
    query = request.GET.get('q')
    if query:
        pets = Pet.objects.filter(
            Q(id__icontains=query) |
            Q(petName__icontains=query) |
            Q(petType__icontains=query) |
            Q(petBreed__icontains=query)
        )
    else:
        pets = Pet.objects.all()
    return render(request, 'pet/pet_list.html', {'pets': pets})

def pet_create(request):
    form = PetForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('pet_list')
    return render(request, 'pet/pet_form.html', {'form': form})

def pet_update(request, id):
    pet = get_object_or_404(Pet, id=id)
    form = PetForm(request.POST or None, instance=pet)
    if form.is_valid():
        form.save()
        return redirect('pet_list')
    return render(request, 'pet/pet_form.html', {'form': form})

def pet_delete(request, id):
    pet = get_object_or_404(Pet, id=id)
    if request.method == "POST":
        pet.delete()
        return redirect('pet_list')
    return render(request, 'pet/pet_delete.html', {'pet': pet})

def consult_list(request):
    query = request.GET.get('q')
    if query:
        consults = Consultation.objects.filter(
            Q(id__icontains=query) |
            Q(petID__petName__icontains=query) |
            Q(vetID__vetFName__icontains=query) |
            Q(vetID__vetLName__icontains=query)
        )
    else:
        consults = Consultation.objects.all()
    return render(request, 'consult/consultation_list.html', {'consults': consults})

def consult_create(request):
    form = ConsultationForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('consult_list')
    return render(request, 'consult/consultation_form.html', {'form': form})

def consult_update(request, id):
    consult = get_object_or_404(Consultation, id=id)
    form = ConsultationForm(request.POST or None, instance=consult)
    if form.is_valid():
        form.save()
        return redirect('consult_list')
    return render(request, 'consult/consultation_form.html', {'form': form})

def consult_delete(request, id):
    consult = get_object_or_404(Consultation, id=id)
    if request.method == "POST":
        consult.delete()
        return redirect('consult_list')
    return render(request, 'consult/consultation_delete.html', {'consult': consult})

def consult_inquiry(request):
    vets = Veterinarian.objects.all()
    consults = Consultation.objects.all()

    # Get all possible filter inputs
    specialization = request.POST.get('specialization', '').strip()
    pet_id = request.POST.get('pet_id')
    petowner_id = request.POST.get('petowner_id')
    vet_id = request.POST.get('vet_id')
    date_from = request.POST.get('date_from')
    date_to = request.POST.get('date_to')

    # Apply filters only if input is provided
    if request.method == 'POST':
        if specialization:
            consults = consults.filter(vetID__vetSpecial__icontains=specialization)
        if pet_id:
            consults = consults.filter(petID__id=pet_id)
        if petowner_id:
            consults = consults.filter(petID__petOwnerID__id=petowner_id)
        if vet_id:
            consults = consults.filter(vetID__id=vet_id)
        if date_from and date_to:
            consults = consults.filter(consultDate__range=[date_from, date_to])

    total_count = consults.aggregate(count=Count('id'))['count'] if consults else 0

    return render(request, 'consult/inquiry.html', {
        'vets': vets,
        'consults': consults,
        'total_count': total_count
    })

    <h2>Welcome to Clinic!</h2>

<ul>
    <li><a href="{% url 'petowner_list' %}">Pet Owners</a></li>
    <li><a href="{% url 'vet_list' %}">Veterinarian</a></li>
    <li><a href="{% url 'pet_list' %}">Pet</a></li>
    <li><a href="{% url 'consult_list' %}">Consultations</a></li>
    <li><a href="{% url 'consult_inquiry' %}">Inquiries</a></li>
    
</ul>

<h1>Delete Pet Owner</h1>
<p>Are you sure you want to delete {{ petowner.petOwnerFName }} {{ petowner.petOwnerLName }}?</p>
<form method="post">
    {% csrf_token %}
    <button type="submit">Yes, Delete</button>
    <a href="/petowners/">Cancel</a>
</form>

<h1>{% if form.instance.pk %}Edit{% else %}Add{% endif %} Pet Owner</h1>
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Save</button>
</form>
<a href="/petowners/">Back</a>

<h1>Pet Owners</h1>

<form method="get">
    <input type="text" name="q" value="{{ query|default:'' }}">
    <button type="submit">Search</button>
</form>

<a href="/petowners/create/">Add New</a>
<table border="1">
    <tr>
        <th>ID</th>
        <th>First Name</th>
        <th>Last Name</th>
        <th>Birth Date</th>
        <th>Tel No</th>
        <th>Actions</th>
    </tr>
{% for p in petowners %}
<tr>
    <td>{{ p.id }}</td>
    <td>{{ p.petOwnerFName }}</td>
    <td>{{ p.petOwnerLName }}</td>
    <td>{{ p.petOwnerBDate }}</td>
    <td>{{ p.petOwnerTelNo }}</td>
    <td>
        <a href="{% url 'petowner_update' p.id %}">Edit</a>
        <a href="{% url 'petowner_delete' p.id %}">Delete</a>
    </td>
</tr>
{% endfor %}
</table>
<a href="{% url 'home' %}">Back</a>




{% load static %}

{% block content %}
<h1>Consultation Inquiry</h1>

<form method="post">
    {% csrf_token %}

    <label>Vet Specialization:</label>
    <input type="text" name="specialization" value="{{ request.POST.specialization }}"><br><br>

    <label>Pet ID:</label>
    <input type="number" name="pet_id" value="{{ request.POST.pet_id }}"><br><br>

    <label>PetOwner ID:</label>
    <input type="number" name="petowner_id" value="{{ request.POST.petowner_id }}"><br><br>

    <label>Vet:</label>
    <select name="vet_id">
        <option value="">--Select Vet--</option>
        {% for v in vets %}
        <option value="{{ v.id }}" {% if request.POST.vet_id == v.id|stringformat:"s" %}selected{% endif %}>
            {{ v.vetFName }} {{ v.vetLName }}
        </option>
        {% endfor %}
    </select><br><br>

    <label>Date From:</label>
    <input type="date" name="date_from" value="{{ request.POST.date_from }}">
    <label>Date To:</label>
    <input type="date" name="date_to" value="{{ request.POST.date_to }}"><br><br>

    <button type="submit">Search</button>
</form>

{% if consults %}
<h2>Results (Total: {{ total_count }})</h2>
<table border="1" cellpadding="5" cellspacing="0">
<tr>
    <th>Consultation ID</th>
    <th>Pet</th>
    <th>Pet Owner</th>
    <th>Vet</th>
    <th>Date</th>
    <th>Diagnoses</th>
    <th>Prescription</th>
</tr>

{% for c in consults %}
<tr>
    <td>{{ c.id }}</td>
    <td>{{ c.petID.petName }}</td>
    <td>{{ c.petID.petOwnerID.petOwnerFName }} {{ c.petID.petOwnerID.petOwnerLName }}</td>
    <td>{{ c.vetID.vetFName }} {{ c.vetID.vetLName }}</td>
    <td>{{ c.consultDate }}</td>
    <td>{{ c.diagnoses }}</td>
    <td>{{ c.prescription }}</td>
</tr>
{% endfor %}
</table>
{% else %}
{% if request.method == 'POST' %}
<p>No results found.</p>
{% endif %}
{% endif %}

<br>
<a href="{% url 'home' %}">Back</a>
{% endblock %}















    

    
