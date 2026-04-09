"use client";
import React, { useState, useEffect } from 'react';

export default function WardShiftApp() {
  const [view, setView] = useState<'RECORD' | 'DASHBOARD'>('RECORD');
  const [nurseName, setNurseName] = useState("กำลังดึงข้อมูลชื่อ...");
  const [nurseID, setNurseID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [isSaving, setIsSaving] = useState(false);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState<string | null>(null);

  // ✅ ใส่ URL ที่แม่ส่งมาให้เรียบร้อยแล้วครับ
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzY8umdvLZWC1haEHe8kYuRRFCi8OUgYNRIK-7yzqlESRxG99p9E7sbmOk8bkKeDoVGVg/exec";

  const initialShift = { active: false, workType: 'NORMAL', hours: 8, extraHours: 0 };
  const [shifts, setShifts] = useState({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });

  useEffect(() => {
    const savedID = localStorage.getItem("nurse_id");
    if (savedID) {
      setNurseID(savedID);
      // ดึงชื่อพยาบาล (แบบเดิมที่แม่เคยได้ชื่อ)
      fetch(`${SCRIPT_URL}?action=getNurseName&id=${savedID}&t=${Date.now()}`)
        .then(res => res.text())
        .then(name => {
          if (name && !name.includes("<")) setNurseName(name.trim());
          else setNurseName("ไม่พบรหัส: " + savedID);
        })
        .catch(() => setNurseName("เชื่อมต่อไม่ได้"));

      // ดึงข้อมูล Dashboard
      fetch(`${SCRIPT_URL}?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => setSheetData(data))
        .catch(() => {});
    } else { window.location.href = "/"; }
  }, []);

  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง") || nurseName.includes("ไม่ได้")) return alert("รอชื่อขึ้นก่อนนะครับ");
    setIsSaving(true);
    try {
      const activeShifts = Object.entries(shifts).filter(([_, d]) => d.active);
      const payloads = [];
      if (leaveType) {
        payloads.push({ date: selectedDate, nurseName, shiftName: leaveType, workType: 'LEAVE', hours: 0, total: 0 });
      } else {
        if (activeShifts.length === 0) { alert("กรุณาเลือกเวร"); setIsSaving(false); return; }
        for (const [id, data] of activeShifts) {
          const sThai = id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก';
          const OT_RATE = 650 / 8;
          let total = (data.workType === 'NORMAL') 
            ? (id === 'morn' ? 0 : 360) + (data.extraHours * OT_RATE)
            : (data.hours * OT_RATE);
          payloads.push({ date: selectedDate, nurseName, shiftName: sThai, workType: data.workType, hours: data.workType === 'NORMAL' ? data.extraHours : data.hours, total });
        }
      }
      for (const p of payloads) {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(p) });
      }
      alert("✅ บันทึกสำเร็จ!");
      window.location.reload(); 
    } catch (e) { alert("เกิดข้อผิดพลาด"); }
    setIsSaving(false);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-md mx-auto space-y-4">
        {/* เมนูสลับหน้า */}
        <div className="flex bg-white p-1 rounded-2xl border shadow-sm">
          <button onClick={() => setView('RECORD')} className={`flex-1 py-3 rounded-xl font-bold ${view === 'RECORD' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>บันทึกเวร</button>
          <button onClick={() => setView('DASHBOARD')} className={`flex-1 py-3 rounded-xl font-bold ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ตารางเวร Grid</button>
        </div>

        {view === 'RECORD' ? (
          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-6 border-t-8 border-green-500">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
              <h2 className="text-xl font-black text-slate-800">{nurseName}</h2>
              <p className="text-xs text-slate-400">ID: {nurseID}</p>
            </div>
            
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold outline-none" />

            <div className="grid grid-cols-3 gap-2">
              {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาศึกษาต่อ', 'ลาพิธีกรรม'].map(type => (
                <button key={type} onClick={() => { setLeaveType(leaveType === type ? null : type); setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } }); }}
                  className={`py-2 rounded-lg text-[10px] font-bold border-2 ${leaveType === type ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}
                >{type}</button>
              ))}
            </div>

            <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
              {(['morn', 'aft', 'night'] as const).map(id => (
                <div key={id} className={`p-4 rounded-2xl border-2 ${shifts[id].active ? 'border-green-500 bg-white shadow-md' : 'bg-slate-50 border-slate-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <input type="checkbox" checked={shifts[id].active} onChange={() => setShifts({...shifts, [id]: {...shifts[id], active: !shifts[id].active}})} className="w-6 h-6 accent-green-600" />
                    <span className="font-black text-lg text-slate-700">{id === 'morn' ? '☀️ เช้า' : id === 'aft' ? '⛅ บ่าย' : '🌙 ดึก'}</span>
                  </div>
                  {shifts[id].active && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-1">
                        {['NORMAL', 'OT', 'BB', 'UNIT', 'CT', 'OPD', 'REF_NO', 'REF_WITH', 'REF_OUT', 'REF_BACK'].map(t => (
                          <button key={t} onClick={() => setShifts({...shifts, [id]: {...shifts[id], workType: t}})} className={`px-2 py-1 rounded text-[9px] font-bold border-2 ${shifts[id].workType === t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-400 border-slate-100'}`}>{t}</button>
                        ))}
                      </div>
                      <div className={`flex items-center gap-2 p-2 rounded-lg border-2 ${shifts[id].workType === 'NORMAL' ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
                        <span className={`text-[10px] font-bold ${shifts[id].workType === 'NORMAL' ? 'text-blue-600' : 'text-amber-600'}`}>{shifts[id].workType === 'NORMAL' ? '⏱️ ล่วงเวลา (ชม.):' : '⏱️ จำนวน (ชม.):'}</span>
                        <input type="number" value={shifts[id].workType === 'NORMAL' ? shifts[id].extraHours : shifts[id].hours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], [shifts[id].workType === 'NORMAL' ? 'extraHours' : 'hours']: Number(e.target.value)}})} className="w-20 p-1 border-2 rounded text-center font-bold" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveToSheet} disabled={isSaving} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">บันทึกลง SHEETS</button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold uppercase tracking-widest leading-tight">ตารางปฏิบัติงานนรีเวช</h2>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full text-[10px] border-collapse">
                <thead><tr className="bg-slate-100"><th className="border p-2 sticky left-0 bg-slate-100 z-10 w-32 font-bold text-slate-600">ชื่อ-สกุล</th>{Array.from({length:31}, (_,i)=><th key={i} className="border p-1 text-center">{i+1}</th>)}</tr></thead>
                <tbody>
                  {Array.from(new Set(sheetData.map(d=>d['ชื่อพยาบาล']))).filter(Boolean).map(name => (
                    <tr key={name} className="hover:bg-slate-50 border-b">
                      <td className="border p-2 font-black text-slate-700 sticky left-0 bg-white z-10 truncate">{name}</td>
                      {Array.from({length:31}, (_,i)=>{
                        const day = i+1;
                        const dRecs = sheetData.filter(d => d['ชื่อพยาบาล'] === name && new Date(d['วันที่']).getDate() === day);
                        if (dRecs.length === 0) return <td key={i} className="border p-1 h-10"></td>;
                        return (
                          <td key={i} className="border p-1 text-center h-10 bg-white">
                            <div className="flex flex-row items-center justify-center gap-0.5">
                              {dRecs.map((r, idx) => {
                                const s = r['เวร']; const t = r['ประเภทงาน'] || "";
                                let char = s === 'เช้า' ? "ช" : s === 'บ่าย' ? "บ" : s === 'ดึก' ? "ด" : s === 'OFF' ? "O" : s.substring(0,1);
                                const isSpecial = t !== 'NORMAL' && t !== 'LEAVE' && t !== "";
                                return (
                                  <span key={idx} className="inline-flex items-start">
                                    <span className="font-bold text-[10px] text-slate-800">{char}</span>
                                    {isSpecial && <span className="text-[6px] font-black text-red-500 leading-none ml-0.5">OT</span>}
                                    {idx < dRecs.length - 1 && <span className="text-slate-300 mx-0.5">/</span>}
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
          </div>
        )}
      </div>
    </div>
  );
}