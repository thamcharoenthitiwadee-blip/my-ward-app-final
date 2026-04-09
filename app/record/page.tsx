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

  useEffect(() => {
    const savedID = localStorage.getItem("nurse_id");
    if (savedID) {
      setNurseID(savedID);
      fetch(`${SCRIPT_URL}?action=getNurseName&id=${savedID}&t=${new Date().getTime()}`)
        .then((res) => res.text())
        .then((name) => {
          if (name && name.trim() !== "" && name !== "ไม่พบรายชื่อ") setNurseName(name.trim());
          else setNurseName("เชื่อมต่อฐานข้อมูลไม่ได้ (ลองสแกนใหม่)");
        })
        .catch(() => setNurseName("เชื่อมต่อฐานข้อมูลไม่ได้"));
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
    if (nurseName.includes("กำลังดึง") || nurseName.includes("เชื่อมต่อ")) return alert("รอให้ชื่อจริงขึ้นก่อนครับ");
    setIsSaving(true);
    try {
      const payloads = [];
      if (leaveType) {
        payloads.push({ date: selectedDate, nurseName, shiftName: leaveType, workType: 'LEAVE', hours: 0, total: 0 });
      } else {
        const activeShifts = Object.entries(shifts).filter(([_, data]) => data.active);
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
      if (payloads.length === 0) { alert("เลือกเวรหรือวันลาก่อน"); setIsSaving(false); return; }
      for (const p of payloads) { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(p) }); }
      alert("✅ บันทึกสำเร็จ!");
      setLeaveType(null);
      setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
    } catch (e) { alert("เกิดข้อผิดพลาด"); }
    setIsSaving(false);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border max-w-md mx-auto">
          <button onClick={() => setView('RECORD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'RECORD' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>บันทึกเวร</button>
          <button onClick={() => setView('DASHBOARD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ตารางเวร Grid</button>
        </div>

        {view === 'RECORD' ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-6 space-y-6 border-t-8 border-green-500">
            <div className={`p-4 rounded-2xl border ${nurseName.includes("เชื่อมต่อ") ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <h2 className={`text-xl font-black ${nurseName.includes("เชื่อมต่อ") ? "text-red-600" : "text-slate-800"}`}>{nurseName}</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {nurseID}</p>
            </div>
            
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg text-sm font-bold" />

            <div className="space-y-3">
              <p className="text-sm font-black text-orange-600">🏖️ วันหยุด / วันลาพัก</p>
              <div className="grid grid-cols-3 gap-2">
                {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาศึกษาต่อ', 'ลาพิธีกรรม'].map(type => (
                  <button key={type} onClick={() => { setLeaveType(leaveType === type ? null : type); setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } }); }}
                    className={`py-3 rounded-xl text-[10px] font-bold border-2 ${leaveType === type ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-100'}`}
                  >{type === 'ลาศึกษาต่อ' ? 'เรียนต่อ' : type === 'ลาพิธีกรรม' ? 'ศาสนา' : type}</button>
                ))}
              </div>
            </div>

            <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
              <p className="text-sm font-black text-green-600">🏥 บันทึกเวรขึ้นจริง</p>
              {(['morn', 'aft', 'night'] as const).map(id => (
                <div key={id} className={`p-4 rounded-2xl border-2 ${shifts[id].active ? 'border-green-500 bg-white shadow-md' : 'border-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={shifts[id].active} onChange={() => setShifts({...shifts, [id]: {...shifts[id], active: !shifts[id].active}})} className="w-6 h-6" />
                    <span className="font-bold text-lg">{id === 'morn' ? '☀️ เช้า' : id === 'aft' ? '⛅ บ่าย' : '🌙 ดึก'}</span>
                  </div>
                  {shifts[id].active && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {['NORMAL', 'OT', 'BB', 'UNIT', 'CT', 'OPD', 'REF_NO', 'REF_WITH', 'REF_OUT', 'REF_BACK'].map(t => (
                          <button key={t} onClick={() => setShifts({...shifts, [id]: {...shifts[id], workType: t}})} className={`px-2 py-1 rounded text-[9px] font-bold border ${shifts[id].workType === t ? 'bg-green-600 text-white' : 'bg-white text-slate-400'}`}>{t}</button>
                        ))}
                      </div>
                      {shifts[id].workType === 'NORMAL' ? (
                        <input type="number" placeholder="ล่วงเวลา (ชม.)" value={shifts[id].extraHours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], extraHours: Number(e.target.value)}})} className="w-full p-2 border rounded text-xs bg-blue-50" />
                      ) : !shifts[id].workType.startsWith('REF') && (
                        <input type="number" placeholder="จำนวน (ชม.)" value={shifts[id].hours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], hours: Number(e.target.value)}})} className="w-full p-2 border rounded text-xs bg-amber-50" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveToSheet} disabled={isSaving || nurseName.includes("เชื่อมต่อ")} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg disabled:bg-slate-300">บันทึกลง SHEETS</button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold tracking-widest uppercase">ตารางปฏิบัติงานนรีเวช</h2>
              <button onClick={fetchDashboardData} className="text-xs bg-indigo-600 px-4 py-2 rounded-full">รีเฟรช</button>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full text-[10px] border-collapse">
                <thead><tr className="bg-slate-100"><th className="border p-2 sticky left-0 bg-slate-100 z-10 w-32">ชื่อ-สกุล</th>{Array.from({ length: 31 }, (_, i) => <th key={i} className="border p-1 w-8 text-center">{i + 1}</th>)}</tr></thead>
                <tbody>
                  {Array.from(new Set(sheetData.map(d => d['ชื่อพยาบาล']))).filter(n => n && !n.includes("เชื่อมต่อ")).map(name => (
                    <tr key={name} className="hover:bg-slate-50 border-b">
                      <td className="border p-2 font-black text-slate-700 sticky left-0 bg-white z-10 truncate">{name}</td>
                      {Array.from({ length: 31 }, (_, i) => {
                        const day = i + 1;
                        const record = sheetData.find(d => d['ชื่อพยาบาล'] === name && new Date(d['วันที่']).getDate() === day);
                        let char = ""; let color = "";
                        if (record) {
                          const s = record['เวร'];
                          if (s === 'เช้า') { char = "ช"; color = "bg-yellow-50 text-yellow-700"; }
                          else if (s === 'บ่าย') { char = "บ"; color = "bg-orange-50 text-orange-700"; }
                          else if (s === 'ดึก') { char = "ด"; color = "bg-indigo-50 text-indigo-700"; }
                          else if (s === 'OFF') { char = "O"; color = "bg-slate-200 text-slate-500"; }
                          else if (s === 'ลาพักร้อน') { char = "พ"; color = "bg-green-100 text-green-700"; }
                          else if (s === 'ลาป่วย') { char = "ป"; color = "bg-red-100 text-red-700"; }
                          else if (s === 'ลากิจ') { char = "ก"; color = "bg-pink-100 text-pink-700"; }
                          else if (s === 'ลาคลอด') { char = "ค"; color = "bg-purple-100 text-purple-700"; }
                          else if (s === 'ลาศึกษาต่อ') { char = "ร"; color = "bg-cyan-100 text-cyan-700"; }
                          else if (s === 'ลาพิธีกรรม') { char = "ศ"; color = "bg-amber-100 text-amber-700"; }
                        }
                        return <td key={i} className={`border p-1 text-center font-bold h-10 ${color}`}>{char}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}