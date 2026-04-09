"use client";
import React, { useState, useEffect, useMemo } from 'react';

export default function WardShiftApp() {
  const [view, setView] = useState<'RECORD' | 'DASHBOARD'>('RECORD');
  const [nurseName, setNurseName] = useState("กำลังดึงข้อมูลชื่อ...");
  const [nurseID, setNurseID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState<string | null>(null);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzY8umdvLZWC1haEHe8kYuRRFCi8OUgYNRIK-7yzqlESRxG99p9E7sbmOk8bkKeDoVGVg/exec";
  const initialShift = { active: false, workType: 'NORMAL', hours: 8, extraHours: 0 };
  const [shifts, setShifts] = useState({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });

  // 🚀 1. ดึงชื่อพยาบาลจากการสแกน QR
  useEffect(() => {
    const savedID = localStorage.getItem("nurse_id");
    if (savedID) {
      setNurseID(savedID);
      fetch(`${SCRIPT_URL}?action=getNurseName&id=${savedID}&t=${new Date().getTime()}`)
        .then((res) => res.text())
        .then((name) => {
          if (name && name.trim() !== "" && name !== "ไม่พบรายชื่อ") setNurseName(name.trim());
          else setNurseName(`ไม่พบชื่อ (รหัส: ${savedID})`);
        })
        .catch(() => setNurseName("เชื่อมต่อฐานข้อมูลไม่ได้"));
    } else {
      window.location.href = "/"; 
    }
  }, []);

  // 📊 2. ดึงข้อมูล Dashboard
  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${SCRIPT_URL}?t=${new Date().getTime()}`);
      const data = await response.json();
      setSheetData(data);
    } catch (e) { console.error("Fetch Error:", e); }
  };

  useEffect(() => { if (view === 'DASHBOARD') fetchDashboardData(); }, [view]);

  // 💾 3. บันทึกข้อมูล (Logic ครบถ้วน)
  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง")) return alert("รอโหลดชื่อครู่เดียวครับ");
    setIsSaving(true);
    try {
      const payloads = [];
      if (leaveType) {
        payloads.push({ date: selectedDate, nurseName, shiftName: leaveType, workType: 'LEAVE', hours: 0, total: 0 });
      } else {
        const activeShifts = Object.entries(shifts).filter(([_, data]) => data.active);
        if (activeShifts.length === 0) { alert("กรุณาเลือกเวร หรือ วันลา"); setIsSaving(false); return; }
        for (const [id, data] of activeShifts) {
          const OT_RATE = 650 / 8;
          let total = 0;
          if (data.workType === 'NORMAL') total = (id === 'morn' ? 0 : 360) + (data.extraHours * OT_RATE);
          else {
            const WORK_TYPES = [{ id: 'REF_NO', price: 325 }, { id: 'REF_WITH', price: 650 }, { id: 'REF_OUT', price: 1000 }, { id: 'REF_BACK', price: 800 }];
            const ref = WORK_TYPES.find(t => t.id === data.workType);
            total = data.workType.startsWith('REF') ? (ref?.price || 0) : (data.hours * OT_RATE);
          }
          payloads.push({
            date: selectedDate, nurseName, shiftName: id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก',
            workType: data.workType, hours: data.workType === 'NORMAL' ? data.extraHours : (data.workType.startsWith('REF') ? 0 : data.hours), total
          });
        }
      }
      for (const p of payloads) {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(p) });
      }
      alert("✅ บันทึกสำเร็จ!");
      setLeaveType(null);
      setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
    } catch (e) { alert("เกิดข้อผิดพลาด"); }
    setIsSaving(false);
  };

  return (
    <div className="p-4 md:p-8 bg-slate-100 min-h-screen font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* เมนูสลับหน้า */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border max-w-md mx-auto">
          <button onClick={() => setView('RECORD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'RECORD' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>บันทึกเวร</button>
          <button onClick={() => setView('DASHBOARD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ตารางเวร Grid</button>
        </div>

        {view === 'RECORD' ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-6 space-y-6 border-t-8 border-green-500">
            <div className="bg-green-50 p-4 rounded-2xl border">
              <h2 className="text-xl font-black text-slate-800">{nurseName}</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {nurseID}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border">
              <p className="text-[10px] text-slate-400 mb-1 font-bold italic">วันที่ปฏิบัติงาน/ลา:</p>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 bg-white border rounded-lg text-sm font-bold outline-none" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-black text-orange-600 uppercase">🏖️ วันหยุด / วันลาพัก</p>
              <div className="grid grid-cols-3 gap-2">
                {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาศึกษาต่อ', 'ลาพิธีกรรม'].map((type) => (
                  <button key={type} onClick={() => { setLeaveType(leaveType === type ? null : type); setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } }); }}
                    className={`py-3 rounded-xl text-[10px] font-bold border-2 transition-all ${leaveType === type ? 'bg-orange-500 text-white border-orange-500 shadow-md scale-95' : 'bg-white text-slate-400 border-slate-100'}`}
                  >{type}</button>
                ))}
              </div>
            </div>
            <hr />
            <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
              <p className="text-sm font-black text-green-600