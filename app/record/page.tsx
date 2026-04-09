"use client";
import React, { useState, useEffect, useMemo } from 'react';

export default function WardShiftApp() {
  const [view, setView] = useState<'RECORD' | 'DASHBOARD'>('RECORD');
  const [nurseName, setNurseName] = useState("กำลังดึงข้อมูลชื่อ...");
  const [nurseID, setNurseID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetData, setSheetData] = useState<any[]>([]);

  // ส่วนบันทึกวันลา/วันหยุด
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

  // 💾 2. ระบบบันทึก (Logic ครบถ้วน)
  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง")) return alert("รอโหลดชื่อครู่เดียวครับ");
    setIsSaving(true);
    try {
      if (leaveType) {
        const payload = { date: selectedDate, nurseName, shiftName: leaveType, workType: 'LEAVE', hours: 0, total: 0 };
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
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
          const payload = {
            date: selectedDate, nurseName, shiftName: id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก',
            workType: data.workType, hours: data.workType === 'NORMAL' ? data.extraHours : (data.workType.startsWith('REF') ? 0 : data.hours), total
          };
          await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        }
      }
      alert("✅ บันทึกสำเร็จ!");
      setLeaveType(null);
      setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
    } catch (e) { alert("เกิดข้อผิดพลาด"); }
    setIsSaving(false);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-6 border-t-8 border-green-500">
          <div className="bg-green-50 p-4 rounded-2xl border">
            <h2 className="text-xl font-black text-slate-800">{nurseName}</h2>
            <p className="text-xs text-slate-400 font-mono">ID: {nurseID}</p>
          </div>

          {/* 📅 วันที่ */}
          <div className="bg-slate-50 p-3 rounded-xl border">
            <p className="text-[10px] text-slate-400 mb-1 font-bold italic">วันที่ปฏิบัติงาน/ลา:</p>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 bg-white border rounded-lg text-sm font-bold outline-none" />
          </div>

          {/* 🏖️ ปุ่มวันหยุด / วันลา (สีส้ม) */}
          <div className="space-y-3">
            <p className="text-sm font-black text-orange-600">🏖️ วันหยุด / วันลาพัก</p>
            <div className="grid grid-cols-3 gap-2">
              {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'เรียนต่อ', 'ศาสนา'].map((type) => (
                <button key={type} onClick={() => { setLeaveType(leaveType === type ? null : type); setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } }); }}
                  className={`py-3 rounded-xl text-[11px] font-bold border-2 transition-all ${leaveType === type ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  {type === 'เรียนต่อ' ? 'ลาศึกษาต่อ' : type === 'ศาสนา' ? 'ลาพิธีกรรม' : type}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 🏥 บันทึกเวร (รายละเอียดครบ 10 ประเภท) */}
          <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
            <p className="text-sm font-black text-green-600">🏥 บันทึกเวรขึ้นจริง</p>
            {(['morn', 'aft', 'night'] as const).map((id) => (
              <div key={id} className={`p-4 rounded-2xl border-2 ${shifts[id].active ? 'border-green-500 bg-white shadow-md' : 'border-slate-50 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={shifts[id].active} onChange={() => setShifts({...shifts, [id]: {...shifts[id], active: !shifts[id].active}})} className="w-6 h-6 accent-green-600" />
                  <span className="font-black text-lg text-slate-700">{id === 'morn' ? '☀️ เช้า' : id === 'aft' ? '⛅ บ่าย' : '🌙 ดึก'}</span>
                </div>
                {shifts[id].active && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {[{id:'NORMAL', label:'NORMAL'},{id:'OT', label:'OT'},{id:'BB', label:'BB'},{id:'UNIT', label:'ออกหน่วย'},{id:'CT', label:'CT'},{id:'OPD', label:'OPD'},{id:'REF_NO', label:'Ref(ไม่มี)'},{id:'REF_WITH', label:'Ref(มี)'},{id:'REF_OUT', label:'Ref(นอก)'},{id:'REF_BACK', label:'Ref(Back)'}].map((t) => (
                        <button key={t.id} onClick={() => setShifts({...shifts, [id]: {...shifts[id], workType: t.id}})} className={`px-2 py-1 rounded text-[9px] font-bold border-2 ${shifts[id].workType === t.id ? 'bg-green-600 text-white' : 'bg-white text-slate-400 border-slate-100'}`}>{t.label}</button>
                      ))}
                    </div>
                    {shifts[id].workType === 'NORMAL' ? (
                      <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-xl"><span className="text-[10px] font-bold text-blue-700">ล่วงเวลา (ชม.):</span><input type="number" value={shifts[id].extraHours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], extraHours: Number(e.target.value)}})} className="w-12 p-1 border rounded text-center text-xs" /></div>
                    ) : !shifts[id].workType.startsWith('REF') && (
                      <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-xl"><span className="text-[10px] font-bold text-amber-700">จำนวน (ชม.):</span><input type="number" value={shifts[id].hours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], hours: Number(e.target.value)}})} className="w-12 p-1 border rounded text-center text-xs" /></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button onClick={handleSaveToSheet} disabled={isSaving} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">
            {isSaving ? "กำลังบันทึก..." : "บันทึกลง SHEETS"}
          </button>
        </div>
      </div>
    </div>
  );
}