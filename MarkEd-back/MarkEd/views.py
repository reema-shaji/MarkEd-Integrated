from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.contrib.auth.hashers import make_password, check_password
from MarkEd.models import User, Course2Marker, Assignment
from django.core.mail import send_mail


def home(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    if request.session.get('user_role', None) == "Student":
        return HttpResponseRedirect("/student/home")
    else:
        return HttpResponseRedirect("/teacher/home")


def login(request):
    if request.session.get('is_login', None):
        return HttpResponseRedirect("/")
    context = {}
    request.encoding = 'utf-8'
    if request.method == "POST":
        try:
            response = User.objects.get(userNumber=request.POST.get('usernumber'))
            if response.isValid:
                if check_password(request.POST.get('password'), response.password):
                    request.session['is_login'] = True
                    request.session['user_id'] = response.id
                    request.session['user_number'] = response.userNumber
                    request.session['user_name'] = response.userName
                    request.session['user_email'] = response.userEmail
                    request.session['user_role'] = response.get_role_display()
                    if response.userProfile:
                        request.session['user_profile'] = str(response.userProfile)
                    else:
                        request.session['user_profile'] = "profile/default_profile.png"
                    
                    if response.must_change_password:
                        return HttpResponseRedirect("/change-password")
                    return HttpResponseRedirect("/")
                else:
                    context["message"] = "Password incorrect!"
                    return render(request, 'login.html', context)
            else:
                context["message"] = "Please validate your account!"
                return render(request, 'login.html', context)
        except:
            context["message"] = "User does not exist!"
            return render(request, 'login.html', context)
    else:
        return render(request, 'login.html', context)


def signup(request):
    
    if request.session.get('is_login', None):
        return HttpResponseRedirect("/")
    context = {}
    if request.method == "POST":
        print("Singups are closed")
        return render(request, 'signup.html', context)
        # try:
        #     if request.POST.get('password') == request.POST.get('passwordcheck'):
            
        #         # Account creation is closed for demo purposes
        #         # hashed_pwd = make_password(request.POST.get('password'))
        #         # new_user = User(userNumber=request.POST.get('usernumber'), userName=request.POST.get('username'), userEmail=request.POST.get('useremail'), userProfile=request.FILES.get('profile'), role=request.POST.get('role'), password=hashed_pwd)
        #         # new_user.save()
        #         # html_message = '<p>Please Validate Your account by <a href="http://35.234.30.63/validate?user_id=' + str(new_user.pk) + '">Click Here</a></p>'
        #         # send_mail('Validate Your Account', 'Hello, ' + request.POST.get('username'), 's1953043@ed.ac.uk', [request.POST.get('useremail')], fail_silently=False, html_message=html_message)
        #         # return HttpResponseRedirect("/login")
        #     else:
        #         context["message"] = "The passwords you entered are different."
        #         return render(request, 'signup.html', context)
        # except:
        #     context["message"] = "The user is already exist!"
        #     return render(request, 'signup.html', context)
    else:
        return render(request, 'signup.html', context)


def validate(request):
    if request.method == "GET":
        if 'user_id' in request.GET:
            validate_user = User.objects.get(pk=request.GET['user_id'])
            validate_user.isValid = True
            validate_user.save()
            return HttpResponseRedirect("/logout")
    return HttpResponseRedirect("/")


def logout(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    del request.session['is_login']
    del request.session['user_id']
    del request.session['user_number']
    del request.session['user_name']
    del request.session['user_email']
    del request.session['user_role']
    del request.session['user_profile']
    return HttpResponseRedirect("/login")


def change_password(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
        
    context = {}
    if request.method == "POST":
        new_password = request.POST.get('new_password')
        confirm_password = request.POST.get('confirm_password')
        
        # Get current user
        user = User.objects.get(id=request.session['user_id'])
        
        # Validate password requirements
        if len(new_password) < 8:
            context["message"] = "Password must be at least 8 characters long!"
            return render(request, 'change_password.html', context)
            
        if not any(c.isupper() for c in new_password):
            context["message"] = "Password must contain at least one uppercase letter!"
            return render(request, 'change_password.html', context)
            
        if not any(c.islower() for c in new_password):
            context["message"] = "Password must contain at least one lowercase letter!"
            return render(request, 'change_password.html', context)
            
        if not any(c.isdigit() for c in new_password):
            context["message"] = "Password must contain at least one number!"
            return render(request, 'change_password.html', context)
        
        if new_password != confirm_password:
            context["message"] = "Passwords do not match!"
            return render(request, 'change_password.html', context)
            
        # Check if new password is same as old password
        if check_password(new_password, user.password):
            context["message"] = "New password cannot be the same as your current password!"
            return render(request, 'change_password.html', context)
        
        user.password = make_password(new_password)
        user.must_change_password = False
        user.save()
        
        return HttpResponseRedirect("/")
        
    return render(request, 'change_password.html', context)

