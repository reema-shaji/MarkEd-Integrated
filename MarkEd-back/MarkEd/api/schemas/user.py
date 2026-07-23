from ninja import Schema

class UserSchema(Schema):
    id: int
    userNumber: str
    userName: str
    userEmail: str
    isValid: bool
    role: str 