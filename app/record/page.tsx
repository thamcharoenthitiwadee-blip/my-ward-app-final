"use client";
import React, { useState, useEffect, useCallback } from 'react';

export default function WardShiftApp() {
  const [view, setView] = useState<'RECORD' | 'DASHBOARD'>('RECORD');
  const [nurseName, setNurseName] = useState("กำลังดึงข้อมูลชื่อ...");
  const [nurseID, setNurseID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [isSaving, setIsSaving] = useState(false);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState<string | null>(null);

  // ✅ URL ของแม่ที่เช็กแล้วว่าใช้ได้แน่นอน
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzY8umdvLZWC1haEHe8kYuRRFCi8OUgYNRIK-7yzqlESRxG99p9E7sbmOk8bkKeDoVGVg/exec";
  
  const initialShift = { active: false, workType: 'NORMAL', hours: 8, extraHours: 0 };
  const [shifts, setShifts] = useState({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });

  // 🚀 1. ฟังก์ชันดึงชื่อพยาบาล (กลับไปใช้แบบที่เคยได้ชื่อสวยๆ)
  useEffect(() => {
    const savedID = localStorage.getItem("nurse_id");
    if (savedID) {
      setNurseID(savedID);
      fetch(`${SCRIPT_URL}?action=getNurseName&id=${savedID}&t=${Date.now()}`)
        .then(res => res.text())
        .then(name => {
          if (name && !name.includes("<") && name !== "ไม่พบรายชื่อ") {
            setNurseName(name.trim());
          } else {
            setNurseName("ไม่พบรหัส: " + savedID);
          }
        })
        .catch(() => setNurseName("เชื่อมต่อฐานข้อมูลไม่ได้"));
    } else {
      window.location.href = "/";
    }
  }, []);

  // 📊 2. ฟังก์ชันดึงข้อมูลตาราง (แยกออกมาไม่ให้กวนการดึงชื่อ)
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
      const data = await res.json();
      setSheetData(data || []);
    } catch (e) {
      console.error("Dashboard error");
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 💾 3. บันทึกข้อมูล (เพิ่มด่านตรวจวันที่ซ้ำแบบปลอดภัย)
  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง") || nurseName.includes("ไม่ได้")) {
      alert("รอให้ชื่อพยาบาลขึ้นก่อนนะครับ");
      return;
    }

    // 🕵️ เช็กวันที่ซ้ำ (เทียบจากชื่อแม่ และ วันที่ในตาราง)
    const hasDataToday = sheetData.some((d: any) => 
      String(d['ชื่อพยาบาล']).trim() === nurseName && 
      String(d['วันที่'] || d['date']).includes(selectedDate)
    );

    if (hasDataToday) {
      const isConfirmed = confirm(`⚠️ วันที่ ${selectedDate} เคยบันทึกไปแล้ว\n\nต้องการ "แก้ไข/บันทึกทับ" ข้อมูลเดิมของวันนี้ใช่หรือไม่?`);
      if (!isConfirmed) return;
    }

    setIsSaving(true);
    try {
      const activeShifts = Object.entries(shifts).filter(([_, data]) => data.active);
      const payloads = [];

      if (leaveType) {
        payloads.push({ date: selectedDate, nurseName, shiftName: leaveType, workType: 'LEAVE', hours: 0, total: 0 });
      } else {
        if (activeShifts.length === 0) { alert("เลือกเวรด้วยครับ"); setIsSaving(false); return; }
        for (const [id, data] of activeShifts) {
          const sThai = id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก';
          const OT_RATE = 650 / 8;
          let total = (data.workType === 'NORMAL') 
            ? (id === 'morn' ? 0 : 360) + (data.extraHours * OT_RATE)
            : (data.workType.startsWith('REF')) 
              ? (data.workType === 'REF_NO' ? 325 : data.workType === 'REF_WITH' ? 650 : data.workType === 'REF_OUT' ? 1000 : 800)
              : (data.hours * OT_RATE);
          
          payloads.push({ date: selectedDate, nurseName, shiftName: sThai, workType: data.workType, hours: data.workType === 'NORMAL' ? data.extraHours : data.hours, total });
        }
      }

      for (const p of payloads) {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(p) });
      }
      alert("✅ เรียบร้อยแล้วค่ะ!");
      setLeaveType(null);
      setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
      fetchDashboard();
    } catch (e) { alert("บันทึกผิดพลาด"); }
    setIsSaving(false);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans text-slate-900">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* เมนูสลับหน้า */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border">
          <button onClick={() => setView('RECORD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'RECORD' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>บันทึกเวร</button>
          <button onClick={() => setView('DASHBOARD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ตารางเวร Grid</button>
        </div>

        {view === 'RECORD' ? (
          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-6 border-t-8 border-green-500">
            {/* 🟢 ส่วนชื่อพยาบาลที่แม่ชอบ */}
            <div className={`p-4 rounded-2xl border ${nurseName.includes("ไม่ได้") ? "bg-red-50" : "bg-green-50 border-green-100"}`}>
              <h2 className={`text-xl font-black ${nurseName.includes("ไม่ได้") ? "text-red-600" : "text-slate-800"}`}>{nurseName}</h2>
              <p className="text-xs text-slate-400">ID: {nurseID}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase tracking-wider">📅 วันที่ปฏิบัติงาน:</p>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none" />
            </div>

            {/* 🏖️ วันหยุด / ลาพัก */}
            <div className="grid grid-cols-3 gap-2">
              {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาศึกษาต่อ', 'ลาพิธีกรรม'].map(type => (
                <button key={type} onClick={() => { setLeaveType(leaveType === type ? null : type); setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } }); }}
                  className={`py-2 rounded-lg text-[10px] font-bold border-2 transition-all ${leaveType === type ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-100'}`}
                >{type}</button>
              ))}
            </div>

            <hr className="border-slate-100" />

            {/* 🏥 บันทึกเวร (ความสวยเดิมกลับมาแล้ว) */}
            <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
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
                      
                      {/* 🔵 คำอธิบายช่องกรอกชั่วโมงที่แม่ต้องการ */}
                      <div className={`flex items-center gap-2 p-2 rounded-lg border-2 ${shifts[id].workType === 'NORMAL' ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
                        <span className={`text-[10px] font-bold ${shifts[id].workType === 'NORMAL' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {shifts[id].workType === 'NORMAL' ? '⏱️ ล่วงเวลา (ชม.):' : '⏱️ จำนวนชั่วโมง OT:'}
                        </span>
                        <input type="number" value={shifts[id].workType === 'NORMAL' ? shifts[id].extraHours : shifts[id].hours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], [shifts[id].workType === 'NORMAL' ? 'extraHours' : 'hours']: Number(e.target.value)}})} className="w-20 p-1 border-2 rounded text-center font-bold text-slate-800 outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handleSaveToSheet} disabled={isSaving || nurseName.includes("กำลังดึง")} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">
              {isSaving ? "กำลังบันทึก..." : "บันทึกลง SHEETS"}
            </button>
          </div>
        ) : (
          /* 📊 ตารางเวร Grid ตัวย่อพร้อมตัวยก OT */
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold uppercase tracking-widest leading-tight">ตารางปฏิบัติงานนรีเวช</h2>
              <button onClick={fetchDashboard} className="text-xs bg-indigo-600 px-4 py-2 rounded-full border border-indigo-400">รีเฟรช</button>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full text-[10px] border-collapse">
                <thead><tr className="bg-slate-100"><th className="border p-2 sticky left-0 bg-slate-100 z-10 w-32 font-bold text-slate-600">ชื่อ-สกุล</th>{Array.from({ length: 31 }, (_, i) => <th key={i} className="border p-1 w-8 text-center font-bold text-slate-50">{i + 1}</th>)}</tr></thead>
                <tbody>
                  {Array.from(new Set(sheetData.map(d => d['ชื่อพยาบาล']))).filter(Boolean).map(name => (
                    <tr key={name} className="hover:bg-slate-50 border-b">
                      <td className="border p-2 font-black text-slate-700 sticky left-0 bg-white z-10 truncate">{name}</td>
                      {Array.from({ length: 31 }, (_, i) => {
                        const day = i + 1;
                        const dRecs = sheetData.filter(d => {
                          const dVal = d['วันที่'] || d['date'];
                          return d['ชื่อพยาบาล'] === name && new Date(dVal).getDate() === day;
                        });
                        if (dRecs.length === 0) return <td key={i} className="border p-1 h-10"></td>;
                        return (
                          <td key={i} className="border p-1 text-center h-10">
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
            <div className="p-4 bg-slate-50 grid grid-cols-4 gap-1 text-[9px] border-t">
              <div>ช=เช้า บ=บ่าย ด=ดึก</div><div>O=OFF พ=พักร้อน ป=ป่วย</div><div>ก=กิจ ค=คลอด ร=เรียน</div><div>ศ=ศาสนา</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}