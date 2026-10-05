from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# --- USER SCHEMAS ---
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str  # "student", "instructor", "admin"
    phone_number: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True  # Allows reading from SQLAlchemy models

# --- TOKEN SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- COURSE SCHEMAS ---
class CourseBase(BaseModel):
    title: str
    description: str
    price: int

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: int
    instructor_id: int
    created_at: datetime
    # We can add 'lessons' list here if needed later

    class Config:
        from_attributes = True

# --- LESSON / CONTENT SCHEMAS ---
class ContentItemBase(BaseModel):
    title: str
    type: str  # "video", "assignment", "pdf"
    content: Optional[str] = None
    order: int

class ContentItemCreate(ContentItemBase):
    course_id: int # Needed to link to a course

class ContentItem(ContentItemBase):
    id: int
    course_id: int
    is_completed: Optional[bool] = False
    
    class Config:
        from_attributes = True