import React, { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView';
import SearchPanel from './components/SearchPanel'; 
import TrafficLegend from './components/TrafficLegend'; 
import { findPath, updateTraffic, resetTraffic, getActiveTraffic } from './api'; 
import './App.css';

function App() {
  // --- STATE CƠ BẢN ---
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trafficSegments, setTrafficSegments] = useState([]);

  // --- STATE ADMIN PANEL ---
  const [isAdmin, setIsAdmin] = useState(false); 
  const [adminType, setAdminType] = useState('congestion'); 
  const [penalty, setPenalty] = useState(5.0); 

  // --- 🌟 MỚI: STATE CHO TÍNH NĂNG MÔ PHỎNG & THUẬT TOÁN ---
  const [visualMode, setVisualMode] = useState(false); 
  const [isVisualizing, setIsVisualizing] = useState(false); 
  const [visitedNodes, setVisitedNodes] = useState([]); 
  const [algorithm, setAlgorithm] = useState('astar'); // Thêm state quản lý thuật toán

  // --- LẤY DỮ LIỆU GIAO THÔNG ---
  const refreshTrafficData = useCallback(async () => {
    try {
      const data = await getActiveTraffic();
      if (data && Array.isArray(data)) setTrafficSegments(data);
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu traffic:", error);
    }
  }, []);

  useEffect(() => {
    refreshTrafficData();
  }, [refreshTrafficData]);

  // --- HÀM CHẠY HIỆU ỨNG LOANG MÀU ---
  const animateSearchProcess = (historyCoords, finalPath) => {
    setIsVisualizing(true);
    setVisitedNodes([]); 
    setPath([]); 

    let currentIndex = 0;
    const CHUNK_SIZE = 15; 

    const timer = setInterval(() => {
      if (currentIndex >= historyCoords.length) {
        clearInterval(timer);
        setPath(finalPath);
        setIsVisualizing(false);
        return;
      }

      const chunk = historyCoords.slice(currentIndex, currentIndex + CHUNK_SIZE);
      setVisitedNodes(prev => [...prev, ...chunk]);
      
      currentIndex += CHUNK_SIZE;
    }, 20); 
  };

  // --- LOGIC TÌM ĐƯỜNG (ĐÃ CẬP NHẬT) ---
  const performRouting = async (s, e) => {
    if (!s || !e) return;
    if (isVisualizing) return; 

    setLoading(true);
    try {
      // Gửi thêm biến visualize và algorithm xuống backend
      const data = await findPath({
        start_lat: parseFloat(s.lat),
        start_lon: parseFloat(s.lng),
        end_lat: parseFloat(e.lat),
        end_lon: parseFloat(e.lng),
        visualize: visualMode,
        algorithm: algorithm // Truyền thuật toán người dùng chọn
      });

      if (data.status === "outside_bounds") {
        alert(data.message); 
        setEnd(null); setPath([]); setVisitedNodes([]);
        return;
      }

      if (data.status === "success" && data.path && data.path.length > 0) {
        const actualStart = data.path[0];
        const actualEnd = data.path[data.path.length - 1];

        setStart({ lat: actualStart.lat, lng: actualStart.lng });
        setEnd({ lat: actualEnd.lat, lng: actualEnd.lng });

        if (visualMode && data.history && data.history.length > 0) {
          animateSearchProcess(data.history, data.path);
        } else {
          setPath(data.path);
          setVisitedNodes([]); 
        }
      } else {
        alert(data.message || "Không tìm thấy lộ trình khả dụng.");
        setPath([]); setEnd(null); setVisitedNodes([]);
      }
    } catch (err) {
      alert("Lỗi kết nối Server: " + err.message);
      setPath([]); setVisitedNodes([]);
    } finally {
      setLoading(false);
    }
  };

  // --- XỬ LÝ CLICK BẢN ĐỒ ---
  const handleMapSelection = async (latlng) => {
    if (isAdmin || isVisualizing) return; 

    if (!start || (start && end)) {
      setStart(latlng);
      setEnd(null);
      setPath([]);
      setVisitedNodes([]); 
    } else {
      setEnd(latlng);
      await performRouting(start, latlng);
    }
  };

  const handleReportAdminPath = async (pathCoords, type, pValue) => {
    if (!pathCoords || pathCoords.length < 2) return;
    setLoading(true);
    try {
      const response = await updateTraffic({
        path_coordinates: pathCoords, 
        flood: type === 'flood' ? pValue : 0.0,
        congestion: type === 'congestion' ? pValue : 1.0
      });

      if (response.status === "success") {
        await refreshTrafficData(); 
        if (start && end) await performRouting(start, end);
      } else {
        alert("Lỗi Admin: " + response.message);
      }
    } catch (err) {
      alert("Lỗi hệ thống Admin: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetTraffic = async () => {
    if (window.confirm("Xác nhận xóa toàn bộ dữ liệu sự cố và khôi phục giao thông bình thường?")) {
      try {
        const response = await resetTraffic();
        if (response.status === "success") {
          setTrafficSegments([]);
          setPath([]);
          setVisitedNodes([]);
          if (start && end) await performRouting(start, end);
          alert(response.message);
        }
      } catch (err) {
        alert("Không thể reset: " + err.message);
      }
    }
  };

  return (
    <div className="app-container" style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <div className="sidebar" style={{
        position: 'absolute', top: 20, left: 20, zIndex: 1000,
        background: 'white', padding: '20px', borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '320px',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '22px', textAlign: 'center' }}>
            HBT Routing AI 🤖
        </h2>

        {/* BẢNG ĐIỀU KHIỂN ADMIN */}
        <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffe0b2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#e67e22' }}>🛠 Chế độ Admin</span>
                <input 
                    type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} disabled={isVisualizing}
                    style={{ cursor: 'pointer', width: '20px', height: '20px' }}
                />
            </div>
            {isAdmin && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select value={adminType} onChange={(e) => setAdminType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <option value="congestion">Báo Tắc đường (x Hệ số)</option>
                        <option value="flood">Báo Ngập lụt (Chặn đường)</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Hệ số:</label>
                        <input type="number" value={penalty} onChange={(e) => setPenalty(parseFloat(e.target.value))} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}/>
                    </div>
                    <button onClick={handleResetTraffic} style={{ marginTop: '5px', padding: '8px', background: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      Xóa toàn bộ sự cố
                    </button>
                </div>
            )}
        </div>

        {/* SEARCH PANELS */}
        <SearchPanel 
            label="📍 ĐIỂM XUẤT PHÁT"
            placeholder={start ? `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}` : "Click bản đồ để chọn..."} 
            onLocationSelect={(coords) => { setStart(coords); setPath([]); setVisitedNodes([]); }} 
        />
        <SearchPanel 
            label="🏁 ĐIỂM ĐẾN"
            placeholder={end ? `${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}` : "Click bản đồ để chọn..."} 
            onLocationSelect={(coords) => { setEnd(coords); if(start) performRouting(start, coords); }} 
        />

        {/* 🌟 MỚI: TÙY CHỌN THUẬT TOÁN & HIỂN THỊ TRỰC QUAN */}
        <div style={{ margin: '15px 0', padding: '15px', background: '#e8f4f8', borderRadius: '8px', border: '1px solid #bce8f1' }}>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '5px' }}>
              Chọn thuật toán:
            </label>
            <select 
              value={algorithm} 
              onChange={(e) => { setAlgorithm(e.target.value); setPath([]); setVisitedNodes([]); }}
              disabled={isVisualizing}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="astar">Thuật toán A*</option>
              <option value="dijkstra">Thuật toán Dijkstra</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              id="visualToggle"
              checked={visualMode}
              onChange={(e) => setVisualMode(e.target.checked)}
              disabled={isVisualizing} 
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label htmlFor="visualToggle" style={{ fontSize: '13px', fontWeight: 'bold', color: '#2980b9', cursor: 'pointer', margin: 0 }}>
              👁️ Xem AI loang màu tìm đường
            </label>
          </div>
        </div>

        {/* BẢNG TRẠNG THÁI */}
        <div className="status-box" style={{ 
            marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '8px',
            borderLeft: `4px solid ${isVisualizing ? '#9b59b6' : loading ? '#3498db' : '#2ecc71'}`
        }}>
          <p style={{ fontSize: '13px', color: '#34495e', margin: 0, fontWeight: isVisualizing ? 'bold' : 'normal' }}>
            {isVisualizing ? "🤖 AI đang suy nghĩ và lan truyền..." :
            isAdmin ? "✏️ Admin: Click điểm đầu, kéo chuột vẽ đoạn tắc" :
            !start ? "👉 Bước 1: Chọn điểm xuất phát" : 
            !end ? "👉 Bước 2: Chọn điểm đến" : 
            loading ? "⏳ Đang kết nối Server..." : "✅ Lộ trình tối ưu đã hoàn tất"}
          </p>
        </div>

        {(start || end) && !isAdmin && (
          <button 
            onClick={() => { setStart(null); setEnd(null); setPath([]); setVisitedNodes([]); }}
            disabled={isVisualizing}
            style={{
              marginTop: '15px', width: '100%', padding: '10px', background: isVisualizing ? '#bdc3c7' : '#e74c3c', 
              color: 'white', border: 'none', borderRadius: '6px', cursor: isVisualizing ? 'not-allowed' : 'pointer', fontWeight: 'bold'
            }}
          >
            Xóa lộ trình & Chọn lại
          </button>
        )}

        <TrafficLegend />
      </div>

      {/* MAP VIEW COMPONENT */}
      <MapView 
        startCoord={start} 
        endCoord={end} 
        path={path} 
        visitedNodes={visitedNodes}
        onMapClick={handleMapSelection} 
        onMapRightClick={handleReportAdminPath} 
        isAdminMode={isAdmin}
        adminConfig={{ type: adminType, penalty: penalty }}
        trafficSegments={trafficSegments}
      />
    </div>
  );
}

export default App;