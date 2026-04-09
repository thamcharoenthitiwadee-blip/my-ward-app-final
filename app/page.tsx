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
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          // ถ้าสแกนเจอ และเป็นรหัส 8 หลัก
          if (decodedText.length === 8) {
            setScanResult(decodedText);
            scanner.clear(); // ปิดกล้อง
            alert("ยินดีต้อนรับรหัสพนักงาน: " + decodedText);
            // เดี๋ยวเราจะเขียนคำสั่งส่งค่าไปเปิดดูข้อมูลใน Google Sheet ตรงนี้ต่อ
          } else {
            alert("รหัสไม่ถูกต้อง (ต้องเป็น 8 หลัก)");
          }
        },
        (error) => {
          // คอยดู error เผื่อกล้องมีปัญหา
        }
      );

      return () => {
        scanner.clear();
      };
    }
  }, [isScanning]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-purple-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-purple-700 mb-6">Nurse Shift Log-in</h1>
        
        {!isScanning ? (
          <button
            onClick={() => setIsScanning(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-all transform hover:scale-105"
          >
            📸 สแกน QR Code เพื่อเข้าสู่ระบบ
          </button>
        ) : (
          <div className="w-full">
            <div id="reader" className="overflow-hidden rounded-xl border-4 border-purple-200"></div>
            <button
              onClick={() => setIsScanning(false)}
              className="mt-4 text-gray-500 underline"
            >
              ยกเลิก
            </button>
          </div>
        )}

        {scanResult && (
          <div className="mt-6 p-4 bg-green-100 text-green-700 rounded-xl">
            กำลังเข้าสู่ระบบด้วยรหัส: <strong>{scanResult}</strong>
          </div>
        )}
      </div>
    </div>
  );
}