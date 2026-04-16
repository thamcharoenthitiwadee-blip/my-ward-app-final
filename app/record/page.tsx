"use client";
import React, { useState, useEffect, useCallback } from 'react';

export default function WardShiftApp() {
  const [view, setView] = useState<'RECORD' | 'DASHBOARD'>('RECORD');
  const [nurseName, setNurseName] = useState("กำลังดึงข้อมูลชื่อ...");
  const [nurseID, setNurseID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // ✨ สถานะการ Sync
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState<string | null>(null);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzY8umdvLZWC1haEHe8kYuRRFCi8OUgYNRIK-7yzqlESRxG99p9E7sbmOk8bkKeDoVGVg/exec";
  const initialShift = { active: false, workType: 'NORMAL', hours: 8, extraHours: 0 };
  const [shifts, setShifts] = useState({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });

  const fetchData = useCallback(async () => {
    const savedID = typeof window !== 'undefined' ? localStorage.getItem("nurse_id") : null;
    if (!savedID) { window.location.href = "/"; return; }
    setNurseID(savedID);

    try {
      const nRes = await fetch(`${SCRIPT_URL}?action=getNurseName&id=${savedID}&t=${Date.now()}`);
      const nText = await nRes.text();
      if (nText && !nText.includes("<") && nText !== "ไม่พบรายชื่อ") {
        setNurseName(nText.trim());
      } else {
        setNurseName("ไม่พบรหัส: " + savedID);
      }

      const dRes = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
      const dData = await dRes.json();
      setSheetData(dData || []);
    } catch (err) {
      setNurseName("เชื่อมต่อฐานข้อมูลไม่ได้");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 🚀 ฟังก์ชันใหม่: สั่ง Sync ข้อมูลลงหน้าตารางสรุปใน Sheets
  const handleSyncToSheets = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${SCRIPT_URL}?action=syncGrid&t=${Date.now()}`);
      const text = await res.text();
      if (text === "Sync Completed") {
        alert("🚀 ว้าว! ส่งข้อมูลเข้าตารางสรุปใน Google Sheets เรียบร้อยแล้วครับแม่");
      }
    } catch (e) {
      alert("เกิดข้อผิดพลาดในการ Sync ครับ");
    }
    setIsSyncing(false);
  };

  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง") || nurseName.includes("ไม่ได้")) return alert("รอให้ชื่อพยาบาลขึ้นก่อนนะครับ");

    const hasDataToday = sheetData.some((d: any) => 
      String(d['ชื่อพยาบาล']).trim() === nurseName && (d['วันที่'] || d['date']).includes(selectedDate)
    );

    if (hasDataToday) {
      if (!confirm(`⚠️ วันที่ ${selectedDate} เคยลงบันทึกไว้แล้ว\nหากตกลง ระบบจะล้างเวรเก่าของวันนี้และบันทึกใหม่แทนที่ทันที ยืนยันไหม?`)) return;
    }

    setIsSaving(true);
    try {
      const payloads = [];
      if (leaveType) {
        payloads.push({ date: selectedDate, nurseName, shiftName: leaveType, workType: 'LEAVE', hours: 0, total: 0 });
      } else {
        const activeShifts = Object.entries(shifts).filter(([_, data]) => data.active);
        if (activeShifts.length === 0) { alert("กรุณาเลือกเวร"); setIsSaving(false); return; }
        for (const [id, data] of activeShifts) {
          const sThai = id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก';
          const OT_RATE = 650 / 8;
          let total = (data.workType === 'NORMAL') 
            ? (id === 'morn' ? 0 : 360) + (data.extraHours * OT_RATE)
            : (data.workType.startsWith('REF') ? (data.workType === 'REF_NO' ? 325 : data.workType === 'REF_WITH' ? 650 : data.workType === 'REF_OUT' ? 1000 : 800) : (data.hours * OT_RATE));
          
          payloads.push({ date: selectedDate, nurseName, shiftName: sThai, workType: data.workType, hours: data.workType === 'NORMAL' ? data.extraHours : (data.workType.startsWith('REF') ? 0 : data.hours), total });
        }
      }

      await fetch(SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify({ nurseName, date: selectedDate, payloads }) 
      });

      alert("✅ บันทึกสำเร็จ!");
      setLeaveType(null);
      setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
      fetchData();
    } catch (e) { alert("เกิดข้อผิดพลาด"); }
    setIsSaving(false);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-4">
        
        <div className="flex bg-white p-1 rounded-2xl border shadow-sm max-w-md mx-auto">
          <button onClick={() => setView('RECORD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'RECORD' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>บันทึกเวร</button>
          <button onClick={() => setView('DASHBOARD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ตารางเวร Grid</button>
        </div>

        {view === 'RECORD' ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-6 space-y-6 border-t-8 border-green-500">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
              <h2 className="text-xl font-black text-slate-800">{nurseName}</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {nurseID}</p>
            </div>
            
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold outline-none" />

            <div className="grid grid-cols-3 gap-2">
              {['OFF', 'ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาศึกษาต่อ', 'ลาประกอบศาสนา'].map(type => (
                <button key={type} onClick={() => { setLeaveType(leaveType === type ? null : type); setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } }); }}
                  className={`py-2 rounded-lg text-[10px] font-bold border-2 transition-all ${leaveType === type ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-400'}`}
                >{type}</button>
              ))}
            </div>

            <hr />

            <div className={`space-y-4 ${leaveType ? 'opacity-20 pointer-events-none' : ''}`}>
              {(['morn', 'aft', 'night'] as const).map(id => (
                <div key={id} className={`p-4 rounded-2xl border-2 transition-all ${shifts[id].active ? 'border-green-500 bg-white shadow-md' : 'border-slate-50 bg-slate-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <input type="checkbox" checked={shifts[id].active} onChange={() => setShifts({...shifts, [id]: {...shifts[id], active: !shifts[id].active}})} className="w-6 h-6 accent-green-600" />
                    <span className="font-black text-lg text-slate-700">{id === 'morn' ? '☀️ เช้า' : id === 'aft' ? '⛅ บ่าย' : '🌙 ดึก'}</span>
                  </div>
                  {shifts[id].active && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-1">
                        {['NORMAL', 'OT', 'BB', 'UNIT', 'CT', 'OPD', 'REF_NO', 'REF_WITH', 'REF_OUT', 'REF_BACK'].map(t => (
                          <button key={t} onClick={() => setShifts({...shifts, [id]: {...shifts[id], workType: t}})} className={`px-2 py-1 rounded text-[9px] font-bold border-2 ${shifts[id].workType === t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-400'}`}>{t}</button>
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
            <button onClick={handleSaveToSheet} disabled={isSaving || nurseName.includes("กำลังดึง")} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95">บันทึกลง SHEETS</button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold uppercase tracking-widest leading-tight">ตารางปฏิบัติงานนรีเวช</h2>
              <div className="flex gap-2">
                 {/* ✨ ปุ่ม Sync มหัศจรรย์ ✨ */}
                <button 
                  onClick={handleSyncToSheets} 
                  disabled={isSyncing}
                  className={`text-[10px] px-3 py-2 rounded-full border border-white/30 font-bold transition-all ${isSyncing ? 'bg-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 shadow-lg active:scale-95'}`}
                >
                  {isSyncing ? "กำลังส่ง..." : "🚀 Sync เข้า Sheets"}
                </button>
                <button onClick={fetchData} className="text-xs bg-indigo-600 px-4 py-2 rounded-full border border-indigo-400 hover:bg-indigo-500 text-white font-bold">รีเฟรช</button>
              </div>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full text-[10px] border-collapse">
                <thead><tr className="bg-slate-100"><th className="border p-2 sticky left-0 bg-slate-100 z-10 w-32 font-bold text-slate-600">ชื่อ-สกุล</th>{Array.from({length:31}, (_, i)=><th key={i} className="border p-1 w-8 text-center font-bold text-slate-500">{i+1}</th>)}</tr></thead>
                <tbody>
                  {Array.from(new Set(sheetData.map(d=>d['ชื่อพยาบาล']))).filter(Boolean).map(name => (
                    <tr key={name} className="hover:bg-slate-50 border-b">
                      <td className="border p-2 font-black text-slate-700 sticky left-0 bg-white z-10 truncate">{name}</td>
                      {Array.from({length:31}, (_, i)=>{
                        const day = i+1;
                        const dRecs = sheetData.filter(d => {
                          const dVal = d['วันที่'] || d['date'];
                          if (!dVal) return false;
                          const dObj = new Date(dVal);
                          return d['ชื่อพยาบาล'] === name && dObj.getDate() === day;
                        });

                        if (dRecs.length === 0) return <td key={i} className="border p-1 h-10"></td>;

                        return (
                          <td key={i} className="border p-1 text-center h-10 bg-white">
                            <div className="flex flex-row items-center justify-center gap-0.5">
                              {dRecs.map((record, index) => {
                                const sArr = (record['เวร'] || record['shiftName'] || "").split("/");
                                const tArr = (record['ประเภทงาน'] || record['workType'] || "").split("/");
                                
                                return (
                                  <React.Fragment key={index}>
                                    <div className="flex gap-0.5 items-start">
                                      {sArr.map((s: string, sIdx: number) => {
                                        let char = s.includes('เช้า') ? "ช" : s.includes('บ่าย') ? "บ" : s.includes('ดึก') ? "ด" : s.includes('OFF') ? "O" : s.includes('พักร้อน') ? "พ" : s.includes('ป่วย') ? "ป" : s.includes('กิจ') ? "ก" : s.includes('คลอด') ? "ค" : (s.includes('ศึกษา') || s.includes('เรียน')) ? "ร" : s.includes('ศาสนา') ? "ศ" : s.substring(0,1);
                                        const type = tArr[sIdx] || tArr[0];
                                        const isSpecial = type !== 'NORMAL' && type !== 'LEAVE' && type !== "";
                                        
                                        return (
                                          <span key={sIdx} className="inline-flex items-start">
                                            <span className="font-bold text-[10px] text-slate-800">{char}</span>
                                            {isSpecial && <sup className="text-[6px] font-black text-red-500 leading-none ml-0.5">{type}</sup>}
                                            {sIdx < sArr.length - 1 && <span className="text-[10px] text-slate-300 mx-0.5">/</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {index < dRecs.length - 1 && <span className="text-[10px] text-slate-300 mx-0.5">/</span>}
                                  </React.Fragment>
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
            <div className="p-4 bg-slate-50 flex flex-wrap gap-x-4 gap-y-1 text-[9px] border-t text-slate-400">
              <span>ช=เช้า บ=บ่าย ด=ดึก</span>
              <span>O=OFF พ=พักร้อน ป=ป่วย</span>
              <span>ก=กิจ ค=คลอด ร=เรียน</span>
              <span>ศ=ศาสนา</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}