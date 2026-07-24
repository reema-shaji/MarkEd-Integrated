from ninja import Schema
from typing import Optional
from .user import UserSchema


class LoginIn(Schema):
    userNumber: str
    password: str


class TokenOut(Schema):
    token: str
    user: UserSchema
    must_change_password: bool = False


class ChangePasswordIn(Schema):
    current_password: str
    new_password: str


class MessageOut(Schema):
    success: bool
    message: str
