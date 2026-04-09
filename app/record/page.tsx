"use client";
import React, { useState, useEffect, useMemo } from 'react';

export default function WardShiftApp() {
  const [view, setView] = useState<'RECORD' | 'DASHBOARD'>('RECORD');
  const [nurseName, setNurseName] = useState("กำลังดึงข้อมูลชื่อ...");
  const [nurseID, setNurseID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetData, setSheetData] = useState<any[]>([]);

  // ⭐️ สำคัญ: ตัวแปรเก็บค่าการลา
  const [leaveType, setLeaveType] = useState<string | null>(null);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzY8umdvLZWC1haEHe8kYuRRFCi8OUgYNRIK-7yzqlESRxG99p9E7sbmOk8bkKeDoVGVg/exec";

  const initialShift = { active: false, workType: 'NORMAL', hours: 8, extraHours: 0 };
  const [shifts, setShifts] = useState({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });

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

  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง")) return alert("รอโหลดชื่อครู่เดียวครับ");
    setIsSaving(true);

    try {
      if (leaveType) {
        // บันทึกวันหยุด/วันลา
        const payload = {
          date: selectedDate,
          nurseName: nurseName,
          shiftName: leaveType,
          workType: 'LEAVE',
          hours: 0,
          total: 0
        };
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      } else {
        // บันทึกเวรปกติ
        const activeShifts = Object.entries(shifts).filter(([_, data]) => data.active);
        if (activeShifts.length === 0) {
          alert("กรุณาเลือกเวร หรือ วันลาก่อนครับ");
          setIsSaving(false);
          return;
        }
        for (const [id, data] of activeShifts) {
          const OT_RATE = 650 / 8;
          const payload = {
            date: selectedDate,
            nurseName: nurseName,
            shiftName: id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก',
            workType: data.workType,
            hours: data.workType === 'NORMAL' ? data.extraHours : data.hours,
            total: data.workType === 'NORMAL' ? (id === 'morn' ? 0 : 360) + (data.extraHours * OT_RATE) : (data.hours * OT_RATE)
          };
          await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        }
      }
      alert("✅ บันทึกสำเร็จ!");
      setLeaveType(null);
      setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
    } catch (e) {
      alert("เกิดข้อผิดพลาด");
    }
    setIsSaving(false);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* ส่วนหัวแสดงชื่อพยาบาล */}
        <div className="bg-white rounded-3xl shadow-lg p-5 border-t-8 border-green-500">
          <div className="bg-green-50 p-4 rounded-2xl mb-4">
            <h2 className="text-xl font-black text-slate-800">{nurseName}</h2>
            <p className="text-xs text-slate-400">ID: {nurseID}</p>
          </div>

          {/* เลือกวันที่ */}
          <div className="mb-6">
            <label className="text-[10px] font-bold text-slate-400 block mb-1">วันที่ปฏิบัติงาน/วันลา:</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
          </div>

          {/* 🏖️ ปุ่มวันหยุด / วันลา (ส่วนที่แม่ต้องการ) */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-black text-orange-600 uppercase">🏖️ ลงบันทึกวันหยุด / วันลา</p>
            <div className="grid grid-cols-3 gap-2">
              {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'เรียนต่อ', 'ศาสนา'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setLeaveType(leaveType === type ? null : type);
                    setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
                  }}
                  className={`py-3 rounded-xl text-[11px] font-bold border-2 transition-all ${leaveType === type ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  {type === 'เรียนต่อ' ? 'ลาศึกษาต่อ' : type === 'ศาสนา' ? 'ลาประกอบพิธีฯ' : type}
                </button>
              ))}
            </div>
          </div>

          <hr className="my-6" />

          {/* 🏥 บันทึกเวรปกติ (จะจางลงถ้ากดปุ่มลาด้านบน) */}
          <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
            <p className="text-sm font-black text-green-600 uppercase">🏥 บันทึกเวรขึ้นจริง</p>
            {(['morn', 'aft', 'night'] as const).map((id) => (
              <div key={id} className={`p-4 rounded-2xl border-2 ${shifts[id].active ? 'border-green-500 bg-white' : 'border-slate-50 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={shifts[id].active} onChange={() => setShifts({...shifts, [id]: {...shifts[id], active: !shifts[id].active}})} className="w-6 h-6 accent-green-600" />
                  <span className="font-bold text-lg">{id === 'morn' ? '☀️ เช้า' : id === 'aft' ? '⛅ บ่าย' : '🌙 ดึก'}</span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSaveToSheet} disabled={isSaving} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg mt-8">
            {isSaving ? "กำลังบันทึก..." : "บันทึกลลง SHEETS"}
          </button>
        </div>
      </div>
    </div>
  );
}