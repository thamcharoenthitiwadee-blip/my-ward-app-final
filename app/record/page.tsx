"use client";
import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    const savedID = localStorage.getItem("nurse_id");
    if (savedID) {
      setNurseID(savedID);
      fetch(`${SCRIPT_URL}?action=getNurseName&id=${savedID}&t=${new Date().getTime()}`)
        .then(res => res.text())
        .then(name => {
          if (name && name.trim() !== "" && name !== "ไม่พบรายชื่อ") setNurseName(name.trim());
          else setNurseName(`ไม่พบชื่อ (รหัส: ${savedID})`);
        });
    } else { window.location.href = "/"; }
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${SCRIPT_URL}?t=${new Date().getTime()}`);
      const data = await response.json();
      setSheetData(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (view === 'DASHBOARD') fetchDashboardData(); }, [view]);

  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง")) return alert("รอโหลดชื่อครู่เดียวครับ");
    
    // 🔍 1. เช็ก "วันที่" ซ้ำก่อนเลย
    const hasDataToday = sheetData.some((d: any) => 
      d['ชื่อพยาบาล'] === nurseName && 
      d['วันที่'] === selectedDate
    );

    if (hasDataToday) {
      const isConfirmed = confirm(`⚠️ วันที่ ${selectedDate} คุณเคยบันทึกข้อมูลไปแล้ว\n\nต้องการ "แก้ไข/บันทึกทับ" ข้อมูลเดิมของวันนี้ใช่หรือไม่?`);
      if (!isConfirmed) return; // ถ้ากด Cancel ก็จบ ไม่ทำต่อ
    }

    setIsSaving(true);
    try {
      const activeShifts = Object.entries(shifts).filter(([_, data]) => data.active);
      const payloads = [];

      if (leaveType) {
        payloads.push({ date: selectedDate, nurseName, shiftName: leaveType, workType: 'LEAVE', hours: 0, total: 0 });
      } else {
        if (activeShifts.length === 0) { alert("กรุณาเลือกเวร หรือ วันลา"); setIsSaving(false); return; }
        for (const [id, data] of activeShifts) {
          const sThai = id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก';
          const OT_RATE = 650 / 8;
          let total = 0;
          if (data.workType === 'NORMAL') total = (id === 'morn' ? 0 : 360) + (data.extraHours * OT_RATE);
          else {
            const WORK_TYPES = [{ id: 'REF_NO', price: 325 }, { id: 'REF_WITH', price: 650 }, { id: 'REF_OUT', price: 1000 }, { id: 'REF_BACK', price: 800 }];
            const ref = WORK_TYPES.find(t => t.id === data.workType);
            total = data.workType.startsWith('REF') ? (ref?.price || 0) : (data.hours * OT_RATE);
          }
          payloads.push({ date: selectedDate, nurseName, shiftName: sThai, workType: data.workType, hours: data.workType === 'NORMAL' ? data.extraHours : data.hours, total });
        }
      }

      // ส่งข้อมูล (ถ้าเป็นการแก้ไข Script ฝั่ง Google จะลบของเก่าให้เอง)
      for (const p of payloads) {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(p) });
      }

      alert("✅ จัดการข้อมูลเรียบร้อยแล้ว!");
      setLeaveType(null);
      setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
      await fetchDashboardData(); // อัปเดตตารางใหม่
    } catch (e) { alert("การเชื่อมต่อมีปัญหา ลองใหม่อีกครั้งครับ"); }
    setIsSaving(false);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* เมนูสลับหน้า */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border max-w-md mx-auto">
          <button onClick={() => setView('RECORD')} className={`flex-1 py-3 rounded-xl font-bold ${view === 'RECORD' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>บันทึกเวร</button>
          <button onClick={() => setView('DASHBOARD')} className={`flex-1 py-3 rounded-xl font-bold ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ตารางเวร Grid</button>
        </div>

        {view === 'RECORD' ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-6 space-y-6 border-t-8 border-green-500">
            <div className="bg-green-50 p-4 rounded-2xl border">
              <h2 className="text-xl font-black">{nurseName}</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {nurseID}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">📅 วันที่ปฏิบัติงาน:</p>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-green-500" />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-black text-orange-600 uppercase">🏖️ วันหยุด / วันลาพัก</p>
              <div className="grid grid-cols-3 gap-2">
                {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาศึกษาต่อ', 'ลาพิธีกรรม'].map(type => (
                  <button key={type} onClick={() => { setLeaveType(leaveType === type ? null : type); setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } }); }}
                    className={`py-3 rounded-xl text-[10px] font-bold border-2 transition-all ${leaveType === type ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}
                  >{type}</button>
                ))}
              </div>
            </div>

            <hr className="border-slate-100" />

            <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
              <p className="text-sm font-black text-green-600 uppercase">🏥 บันทึกเวรขึ้นจริง</p>
              {(['morn', 'aft', 'night'] as const).map(id => (
                <div key={id} className={`p-4 rounded-2xl border-2 transition-all ${shifts[id].active ? 'border-green-500 bg-white shadow-md' : 'border-slate-50 bg-slate-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <input type="checkbox" checked={shifts[id].active} onChange={() => setShifts({...shifts, [id]: {...shifts[id], active: !shifts[id].active}})} className="w-6 h-6 accent-green-600" />
                    <span className="font-black text-lg text-slate-700">{id === 'morn' ? '☀️ เช้า' : id === 'aft' ? '⛅ บ่าย' : '🌙 ดึก'}</span>
                  </div>
                  {shifts[id].active && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-4">
                      <div className="flex flex-wrap gap-1">
                        {['NORMAL', 'OT', 'BB', 'UNIT', 'CT', 'OPD', 'REF_NO', 'REF_WITH', 'REF_OUT', 'REF_BACK'].map(t => (
                          <button key={t} onClick={() => setShifts({...shifts, [id]: {...shifts[id], workType: t}})} className={`px-2 py-1 rounded text-[9px] font-bold border-2 ${shifts[id].workType === t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-400 border-slate-100'}`}>{t}</button>
                        ))}
                      </div>
                      {shifts[id].workType === 'NORMAL' ? (
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-blue-600 flex items-center gap-1">⏱️ ล่วงเวลา (ชม.):</p>
                          <input type="number" value={shifts[id].extraHours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], extraHours: Number(e.target.value)}})} className="w-full p-3 bg-blue-50 border-2 border-blue-200 rounded-xl font-bold text-center" />
                        </div>
                      ) : !shifts[id].workType.startsWith('REF') && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-amber-600 flex items-center gap-1">⏱️ จำนวนชั่วโมง OT:</p>
                          <input type="number" value={shifts[id].hours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], hours: Number(e.target.value)}})} className="w-full p-3 bg-amber-50 border-2 border-amber-200 rounded-xl font-bold text-center" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveToSheet} disabled={isSaving} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all disabled:bg-slate-300">
              {isSaving ? "กำลังส่งข้อมูล..." : "บันทึกลง SHEETS"}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold uppercase tracking-widest">ตารางปฏิบัติงานนรีเวช</h2>
              <button onClick={fetchDashboardData} className="text-xs bg-indigo-600 px-4 py-2 rounded-full border border-indigo-400">รีเฟรช</button>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full text-[10px] border-collapse">
                <thead><tr className="bg-slate-100"><th className="border p-2 sticky left-0 bg-slate-100 z-10 w-32 font-bold text-slate-600">ชื่อ-สกุล</th>{Array.from({ length: 31 }, (_, i) => <th key={i} className="border p-1 w-8 text-center font-bold text-slate-50">{i + 1}</th>)}</tr></thead>
                <tbody>
                  {Array.from(new Set(sheetData.map(d => d['ชื่อพยาบาล']))).filter(Boolean).map(name => (
                    <tr key={name} className="hover:bg-slate-50 border-b">
                      <td className="border p-2 font-black text-slate-700 sticky left-0 bg-white shadow-sm z-10 truncate">{name}</td>
                      {Array.from({ length: 31 }, (_, i) => {
                        const day = i + 1;
                        const dayRecords = sheetData.filter(d => {
                          const dVal = d['วันที่'] || d['date'];
                          return d['ชื่อพยาบาล'] === name && new Date(dVal).getDate() === day;
                        });
                        if (dayRecords.length === 0) return <td key={i} className="border p-1 h-10"></td>;
                        return (
                          <td key={i} className="border p-1 text-center h-10 bg-white">
                            <div className="flex flex-row items-center justify-center gap-0.5">
                              {dayRecords.map((r, idx) => {
                                const s = r['เวร']; const t = r['ประเภทงาน'] || "";
                                let char = s === 'เช้า' ? "ช" : s === 'บ่าย' ? "บ" : s === 'ดึก' ? "ด" : s === 'OFF' ? "O" : s.substring(0,1);
                                const isSpecial = t !== 'NORMAL' && t !== 'LEAVE' && t !== "";
                                return (
                                  <span key={idx} className="inline-flex items-start">
                                    <span className="font-bold text-[10px] text-slate-800">{char}</span>
                                    {isSpecial && <span className="text-[6px] font-black text-red-500 leading-none ml-0.5">OT</span>}
                                    {idx < dayRecords.length - 1 && <span className="text-[10px] text-slate-300 mx-0.5">/</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 grid grid-cols-4 gap-1 text-[9px] border-t">
              <div>ช=เช้า บ=บ่าย ด=ดึก</div><div>O=OFF พ=พักร้อน ป=ป่วย</div><div>ก=กิจ ค=คลอด ร=เรียน</div><div>ศ=ศาสนา</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}