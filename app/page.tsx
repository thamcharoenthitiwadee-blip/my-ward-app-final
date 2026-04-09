"use client";
import React, { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function LoginPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0 
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          // ตรวจสอบว่าเป็นรหัส 8 หลักตามเงื่อนไข
          if (decodedText.length === 8) {
            setScanResult(decodedText);
            scanner.clear(); // ปิดกล้องทันทีที่อ่านค่าได้

            // 1. บันทึกรหัสลงในเครื่อง (localStorage) เพื่อให้หน้า /record ดึงไปใช้งานต่อได้
            localStorage.setItem("nurse_id", decodedText);

            // 2. เปลี่ยนหน้าไปยังหน้าบันทึกเวรทันที
            window.location.href = "/record";
          } else {
            alert("รหัสไม่ถูกต้อง (ต้องเป็นรหัสพนักงาน 8 หลัก)");
          }
        },
        (error) => {
          // คอยดักฟัง Error เฉยๆ ไม่ต้องทำอะไร
        }
      );

      return () => {
        // ล้างระบบ scanner เมื่อออกจากหน้าจอหรือปิดกล้อง
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [isScanning]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-white p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-purple-100">
        <div className="mb-6">
          <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🏥</span>
          </div>
          <h1 className="text-2xl font-bold text-purple-800">Nurse Log-in</h1>
          <p className="text-gray-500 mt-2">สแกน QR Code เพื่อบันทึกเวร</p>
        </div>
        
        {!isScanning ? (
          <button
            onClick={() => setIsScanning(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <span className="text-xl">📸</span>
            เปิดกล้องสแกน QR
          </button>
        ) : (
          <div className="w-full">
            <div id="reader" className="overflow-hidden rounded-2xl border-4 border-purple-200 shadow-inner"></div>
            <button
              onClick={() => setIsScanning(false)}
              className="mt-6 text-purple-600 font-medium hover:text-purple-800 transition-colors"
            >
              ← กลับไปหน้าก่อนหน้า
            </button>
          </div>
        )}

        <div className="mt-8 text-xs text-gray-400">
          ระบบบันทึกเวรพยาบาล v1.0
        </div>
      </div>
    </div>
  );
}