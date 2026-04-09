"use client";
import React, { useState, useEffect, useMemo } from 'react';

export default function WardShiftApp() {
  const [view, setView] = useState<'RECORD' | 'DASHBOARD'>('RECORD');
  const [nurseName, setNurseName] = useState("กำลังดึงข้อมูลชื่อ...");
  const [nurseID, setNurseID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetData, setSheetData] = useState<any[]>([]);

  // URL ของคุณพยาบาล (Script ทำงานได้ปกติแล้วตามที่ทดสอบ)
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzY8umdvLZWC1haEHe8kYuRRFCi8OUgYNRIK-7yzqlESRxG99p9E7sbmOk8bkKeDoVGVg/exec";

  const initialShift = { active: false, workType: 'NORMAL', hours: 8, extraHours: 0 };
  const [shifts, setShifts] = useState({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });

  // --- 🚀 1. ส่วนดึงชื่อพยาบาล (Logic ใหม่ที่ทนทานขึ้น) ---
  useEffect(() => {
    const savedID = localStorage.getItem("nurse_id");
    if (savedID) {
      setNurseID(savedID);
      // ใส่พารามิเตอร์เพื่อกัน Cache ของ Browser
      fetch(`${SCRIPT_URL}?action=getNurseName&id=${savedID}&t=${new Date().getTime()}`)
        .then((res) => res.text())
        .then((name) => {
          if (name && name.trim() !== "" && name !== "ไม่พบรายชื่อ") {
            setNurseName(name.trim());
          } else {
            setNurseName(`ไม่พบชื่อ (รหัส: ${savedID})`);
          }
        })
        .catch((err) => {
          console.error("Fetch Error:", err);
          setNurseName("เชื่อมต่อฐานข้อมูลไม่ได้");
        });
    } else {
      window.location.href = "/"; 
    }
  }, []);

  // --- 📊 2. ส่วน Dashboard ---
  const fetchDashboardData = async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      setSheetData(data);
    } catch (e) { console.error("Fetch Error:", e); }
  };

  useEffect(() => { if (view === 'DASHBOARD') fetchDashboardData(); }, [view]);

  const nurseSummaries = useMemo(() => {
    const summary: Record<string, { shiftBase: number, otAndOthers: number }> = {};
    sheetData.forEach(row => {
      const name = row['ชื่อพยาบาล'];
      const shift = row['เวร'];
      const type = row['ประเภทงาน'];
      const totalAmount = Number(row['ยอดเงินรวม']) || 0;
      if (!summary[name]) summary[name] = { shiftBase: 0, otAndOthers: 0 };
      if (type === 'NORMAL') {
        const baseWage = (shift === 'เช้า' ? 0 : 360);
        summary[name].shiftBase += baseWage;
        summary[name].otAndOthers += (totalAmount - baseWage);
      } else {
        summary[name].otAndOthers += totalAmount;
      }
    });
    return Object.entries(summary);
  }, [sheetData]);

  // --- 💾 3. ส่วนการคำนวณเงินและการบันทึก ---
  const getShiftEarnings = (id: 'morn' | 'aft' | 'night', data: typeof initialShift) => {
    if (!data.active) return 0;
    const OT_RATE = 650 / 8;
    if (data.workType === 'NORMAL') return (id === 'morn' ? 0 : 360) + (data.extraHours * OT_RATE);
    const WORK_TYPES = [{ id: 'REF_NO', price: 325 }, { id: 'REF_WITH', price: 650 }, { id: 'REF_OUT', price: 1000 }, { id: 'REF_BACK', price: 800 }];
    const ref = WORK_TYPES.find(t => t.id === data.workType);
    return data.workType.startsWith('REF') ? (ref?.price || 0) : (data.hours * OT_RATE);
  };

  const handleSaveToSheet = async () => {
    if (nurseName.includes("กำลังดึง")) {
      alert("❌ กรุณารอให้ระบบโหลดชื่อเสร็จก่อนครับ");
      return;
    }
    setIsSaving(true);
    const activeShifts = Object.entries(shifts).filter(([_, data]) => data.active);
    for (const [id, data] of activeShifts) {
      const payload = {
        date: selectedDate, 
        nurseName: nurseName, 
        shiftName: id === 'morn' ? 'เช้า' : id === 'aft' ? 'บ่าย' : 'ดึก',
        workType: data.workType, 
        hours: data.workType === 'NORMAL' ? data.extraHours : (data.workType.startsWith('REF') ? 0 : data.hours),
        total: getShiftEarnings(id as any, data)
      };
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
    }
    alert("✅ บันทึกสำเร็จ!");
    setShifts({ morn: { ...initialShift }, aft: { ...initialShift }, night: { ...initialShift } });
    setIsSaving(false);
  };

  return (
    <div className="p-4 md:p-8 bg-slate-100 min-h-screen font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6 max-w-md mx-auto border">
          <button onClick={() => setView('RECORD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'RECORD' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>บันทึกเวร</button>
          <button onClick={() => setView('DASHBOARD')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>สรุปยอดรวม</button>
        </div>

        {view === 'RECORD' ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border p-5 space-y-5">
            <div className="flex items-center gap-3 bg-green-50 p-4 rounded-2xl border border-green-100">
              <div className="text-3xl bg-white w-12 h-12 rounded-full flex items-center justify-center shadow-sm">👤</div>
              <div>
                <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">ยินดีต้อนรับ</p>
                <h2 className="text-lg font-black text-slate-800 leading-tight">{nurseName}</h2>
                <p className="text-[9px] text-slate-400 font-mono">Employee ID: {nurseID}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border">
              <p className="text-[10px] text-slate-400 mb-1 font-bold">วันที่ปฏิบัติงาน:</p>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 bg-white border rounded-lg text-sm font-bold outline-none shadow-sm focus:border-green-500 transition-all" />
            </div>

            <div className="space-y-4">
              {(['morn', 'aft', 'night'] as const).map((id) => (
                <div key={id} className={`p-4 rounded-2xl border-2 transition-all ${shifts[id].active ? 'border-green-500 bg-white shadow-md' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                   <div className="flex items-center gap-3 mb-2">
                    <input type="checkbox" checked={shifts[id].active} onChange={() => setShifts({...shifts, [id]: {...shifts[id], active: !shifts[id].active}})} className="w-6 h-6 rounded text-green-600 cursor-pointer" />
                    <span className="font-black text-lg">{id === 'morn' ? '☀️ เช้า' : id === 'aft' ? '⛅ บ่าย' : '🌙 ดึก'}</span>
                  </div>
                  {shifts[id].active && (
                    <div className="space-y-3 mt-2 border-t pt-3">
                      <div className="flex flex-wrap gap-1">
                        {[{id:'NORMAL', label:'NORMAL'},{id:'OT', label:'OT'},{id:'BB', label:'BB'},{id:'UNIT', label:'ออกหน่วย'},{id:'CT', label:'CT'},{id:'OPD', label:'OPD'},{id:'REF_NO', label:'Ref(ไม่มี)'},{id:'REF_WITH', label:'Ref(มี)'},{id:'REF_OUT', label:'Ref(นอก)'},{id:'REF_BACK', label:'Ref(Back)'}].map((type) => (
                          <button key={type.id} onClick={() => setShifts({...shifts, [id]: {...shifts[id], workType: type.id}})}
                            className={`px-2 py-1 rounded-md text-[9px] font-bold border-2 transition-all ${shifts[id].workType === type.id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-400 border-slate-100'}`}
                          >{type.label}</button>
                        ))}
                      </div>
                      {shifts[id].workType === 'NORMAL' && (
                        <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-xl border border-blue-100">
                          <span className="text-xs font-bold text-blue-700">ล่วงเวลา (ชม.):</span>
                          <input type="number" value={shifts[id].extraHours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], extraHours: Number(e.target.value)}})} className="w-16 p-1 bg-white border rounded text-center font-bold text-blue-700 outline-none" />
                        </div>
                      )}
                      {!['NORMAL'].includes(shifts[id].workType) && !shifts[id].workType.startsWith('REF') && (
                        <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-xl border border-amber-100">
                          <span className="text-xs font-bold text-amber-700">จำนวน (ชม.):</span>
                          <input type="number" value={shifts[id].hours} onChange={(e) => setShifts({...shifts, [id]: {...shifts[id], hours: Number(e.target.value)}})} className="w-16 p-1 bg-white border rounded text-center font-bold text-amber-700 outline-none" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveToSheet} disabled={isSaving || nurseName.includes("กำลังดึง")} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 uppercase">
              {isSaving ? "ระบบกำลังบันทึก..." : "บันทึกลง Sheets"}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold uppercase tracking-widest">สรุปยอดรวม</h2>
              <button onClick={fetchDashboardData} className="text-xs bg-indigo-600 px-4 py-2 rounded-full border border-indigo-400 hover:bg-indigo-500 transition-all">รีเฟรชข้อมูล</button>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="p-4">รายชื่อพยาบาล</th>
                    <th className="p-4 text-right">ค่าเวร</th>
                    <th className="p-4 text-right">OT & อื่นๆ</th>
                    <th className="p-4 text-right text-indigo-600 font-black">รวมสุทธิ</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {nurseSummaries.length > 0 ? nurseSummaries.map(([name, data], i) => (
                    <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-slate-700">{name}</td>
                      <td className="p-4 text-right text-emerald-600 font-bold">{data.shiftBase.toLocaleString()}</td>
                      <td className="p-4 text-right text-orange-500 font-bold">{data.otAndOthers.toLocaleString()}</td>
                      <td className="p-4 text-right font-black text-indigo-700 text-lg">{(data.shiftBase + data.otAndOthers).toLocaleString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-10 text-center text-slate-300 italic">ยังไม่มีข้อมูลบันทึกในวันนี้...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}