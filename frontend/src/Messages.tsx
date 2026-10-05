// src/Messages.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import API_BASE_URL from './config';
import { Send, Users, BookOpen, User } from "lucide-react";

// define basic types to satisfy TypeScript
interface Course {
  id: number;
  title: string;
}

interface Student {
  id: number;
  full_name: string;
  email: string;
}

const Messages = () => {
    const [targetType, setTargetType] = useState("all"); // all, course, student
    const [targetId, setTargetId] = useState("");
    const [message, setMessage] = useState("");
    const [courses, setCourses] = useState<Course[]>([]);
    const [students, setStudents] = useState<Student[]>([]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        axios.get(`${API_BASE_URL}/courses`, { headers: { Authorization: `Bearer ${token}` } }).then(res => setCourses(res.data));
        axios.get(`${API_BASE_URL}/admin/students`, { headers: { Authorization: `Bearer ${token}` } }).then(res => setStudents(res.data));
    }, []);

    const handleSend = async () => {
        if(!message) return alert("Please type a message");
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/notifications/send`, {
                target_type: targetType,
                target_id: targetId ? parseInt(targetId) : null,
                message
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert("Message Sent!");
            setMessage("");
        } catch(err) { alert("Failed to send"); }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">Broadcast Messages</h1>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                {/* 1. Select Audience */}
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-2">To Whom?</label>
                    <div className="flex gap-4">
                        <button onClick={() => setTargetType("all")} className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${targetType === "all" ? "bg-blue-50 border-blue-500 text-blue-600 font-bold" : "border-slate-200 text-slate-500"}`}><Users size={18}/> All Students</button>
                        <button onClick={() => setTargetType("course")} className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${targetType === "course" ? "bg-blue-50 border-blue-500 text-blue-600 font-bold" : "border-slate-200 text-slate-500"}`}><BookOpen size={18}/> Specific Course</button>
                        <button onClick={() => setTargetType("student")} className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${targetType === "student" ? "bg-blue-50 border-blue-500 text-blue-600 font-bold" : "border-slate-200 text-slate-500"}`}><User size={18}/> Specific Student</button>
                    </div>
                </div>

                {/* 2. Select Target (Conditional) */}
                {targetType === "course" && (
                    <select className="w-full p-3 border rounded-lg" onChange={(e) => setTargetId(e.target.value)}>
                        <option value="">Select Course...</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                )}
                {targetType === "student" && (
                    <select className="w-full p-3 border rounded-lg" onChange={(e) => setTargetId(e.target.value)}>
                        <option value="">Select Student...</option>
                        {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>)}
                    </select>
                )}

                {/* 3. Message */}
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Message</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500" placeholder="Type your announcement here..."></textarea>
                </div>

                <button onClick={handleSend} className="bg-[#0088C7] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all"><Send size={18} /> Send Notification</button>
            </div>
        </div>
    );
};
export default Messages;