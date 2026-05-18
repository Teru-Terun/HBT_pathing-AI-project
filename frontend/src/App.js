import React, { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView';
import SearchPanel from './components/SearchPanel'; 
import TrafficLegend from './components/TrafficLegend'; 
import { findPath, updateTraffic, resetTraffic, getActiveTraffic } from './api'; 
import './App.css';

function App() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trafficSegments, setTrafficSegments] = useState([]);
  const pathIntervalRef = React.useRef(null);
  // --- TRẠNG THÁI ADMIN PANEL ---
  const [isAdmin, setIsAdmin] = useState(false); 
  const [adminType, setAdminType] = useState('congestion'); 
  const [penalty, setPenalty] = useState(5.0); 

  // --- HÀM LẤY DỮ LIỆU GIAO THÔNG (REFRESH) ---
  const refreshTrafficData = useCallback(async () => {
    try {
      const data = await getActiveTraffic();
      // Backend trả về mảng các đoạn đường đang có sự cố
      if (data && Array.isArray(data)) {
        setTrafficSegments(data);
      }
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu traffic:", error);
    }
  }, []);
 
  // Tạo useEffect mới
  useEffect(() => {
    // Khi component bị đóng, xóa interval ngay lập tức
    return () => {
        if (pathIntervalRef.current) clearInterval(pathIntervalRef.current);
    };
}, []); 

  useEffect(() => {
    refreshTrafficData();
  }, [refreshTrafficData]);
  
  // Hiện từng node trên đường đi
  const animatePath = (fullPath) => {
    // Bước A: Xóa bỏ mọi interval đang chạy trước đó (nếu có)
    if (pathIntervalRef.current) {
        clearInterval(pathIntervalRef.current);
    }

    // Bước B: Reset đường đi về rỗng để bắt đầu vẽ từ đầu
    setPath([]); 
    
    let currentIndex = 0;
    const speed = 30; // Tốc độ vẽ: 30ms/node. Bạn có thể tăng lên 50 nếu muốn chậm hơn.

    // Bước C: Thiết lập interval để nạp dần tọa độ
    pathIntervalRef.current = setInterval(() => {
        if (currentIndex < fullPath.length) {
            // Cập nhật path: lấy thêm 1 node mỗi lần chạy
            setPath(fullPath.slice(0, currentIndex + 1));
            currentIndex++;
        } else {
            // Bước D: Khi vẽ xong thì dọn dẹp interval
            clearInterval(pathIntervalRef.current);
            pathIntervalRef.current = null;
        }
    }, speed);
}; 
  // --- LOGIC TÌM ĐƯỜNG ĐỒNG BỘ VỚI BACKEND ---
  const performRouting = async (s, e) => {
    if (!s || !e) return;
    setLoading(true);
    try {
      const data = await findPath({
        start_lat: parseFloat(s.lat),
        start_lon: parseFloat(s.lng),
        end_lat: parseFloat(e.lat),
        end_lon: parseFloat(e.lng)
      });

      console.log("Dữ liệu nhận được:", data);

      // 1. Xử lý trường hợp ngoài phạm vi (Geofencing)
      if (data.status === "outside_bounds") {
        alert(data.message); 
        setEnd(null); 
        setPath([]);
        return;
      }

      // 2. Xử lý thành công
      if (data.status === "success" && data.path && data.path.length > 0) {
        //setPath(data.path)
        animatePath(data.path); 

        // --- CẢI TIẾN QUAN TRỌNG: SNAP MARKER TO ROAD ---
        // Lấy tọa độ Node thực tế đầu tiên và cuối cùng từ kết quả của Backend
        const actualStart = data.path[0];
        const actualEnd = data.path[data.path.length - 1];

        // Cập nhật lại vị trí Marker để chúng khớp hoàn toàn với điểm đầu/cuối của đường xanh
        setStart({ lat: actualStart.lat, lng: actualStart.lng });
        setEnd({ lat: actualEnd.lat, lng: actualEnd.lng });
        // ----------------------------------------------

      } else {
        alert(data.message || "Không tìm thấy lộ trình khả dụng.");
        setPath([]);
        setEnd(null);
      }
    } catch (err) {
      alert("Lỗi kết nối Server: " + err.message);
      setPath([]);
    } finally {
      setLoading(false);
    }
  };

  // --- XỬ LÝ CLICK BẢN ĐỒ ---
  const handleMapSelection = async (latlng) => {
    if (isAdmin) return; // Không làm gì nếu đang ở chế độ Admin

    if (!start || (start && end)) {
      // Nếu chưa có start hoặc đã có cả cặp (vừa hoàn thành 1 tour) -> Reset chọn mới
      setStart(latlng);
      setEnd(null);
      setPath([]);
    } else {
      // Đã có start, giờ chọn end
      setEnd(latlng);
      await performRouting(start, latlng);
    }
  };

  // --- LOGIC BÁO CÁO SỰ CỐ (ADMIN) ---
  const handleReportAdminPath = async (pathCoords, type, pValue) => {
    if (!pathCoords || pathCoords.length < 2) return;

    setLoading(true);
    try {
      // Đồng bộ với Schema TrafficPathUpdate trong main.py
      const response = await updateTraffic({
        path_coordinates: pathCoords, 
        flood: type === 'flood' ? pValue : 0.0,
        congestion: type === 'congestion' ? pValue : 1.0
      });

      if (response.status === "success") {
        await refreshTrafficData(); // Load lại các vệt màu sự cố
        
        // CỰC KỲ QUAN TRỌNG: Nếu đang có sẵn đường đi, tự động tìm lại để xem kết quả "né"
        if (start && end) {
          await performRouting(start, end);
        }
      } else {
        alert("Lỗi Admin: " + response.message);
      }
    } catch (err) {
      alert("Lỗi hệ thống Admin: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- RESET TOÀN BỘ HỆ THỐNG ---
  const handleResetTraffic = async () => {
    if (window.confirm("Xác nhận xóa toàn bộ dữ liệu sự cố và khôi phục giao thông bình thường?")) {
      try {
        const response = await resetTraffic();
        if (response.status === "success") {
          setTrafficSegments([]);
          setPath([]);
          // Tìm lại đường (sẽ quay về đường ngắn nhất gốc)
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
                    type="checkbox" 
                    checked={isAdmin} 
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    style={{ cursor: 'pointer', width: '20px', height: '20px' }}
                />
            </div>
            
            {isAdmin && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select 
                        value={adminType} 
                        onChange={(e) => setAdminType(e.target.value)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        <option value="congestion">Báo Tắc đường (x Hệ số)</option>
                        <option value="flood">Báo Ngập lụt (Chặn đường)</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Hệ số:</label>
                        <input 
                            type="number" 
                            value={penalty} 
                            onChange={(e) => setPenalty(parseFloat(e.target.value))}
                            style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                    </div>
                    <button 
                      onClick={handleResetTraffic}
                      style={{
                        marginTop: '5px', padding: '8px', background: '#e67e22', color: 'white',
                        border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                      }}
                    >
                      Xóa toàn bộ sự cố
                    </button>
                </div>
            )}
        </div>

        {/* SEARCH & STATUS */}
        <SearchPanel 
            label="📍 ĐIỂM XUẤT PHÁT"
            placeholder={start ? `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}` : "Click bản đồ để chọn..."} 
            onLocationSelect={(coords) => { setStart(coords); setPath([]); }} 
        />
        
        <SearchPanel 
            label="🏁 ĐIỂM ĐẾN"
            placeholder={end ? `${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}` : "Click bản đồ để chọn..."} 
            onLocationSelect={(coords) => { setEnd(coords); if(start) performRouting(start, coords); }} 
        />

        <div className="status-box" style={{ 
            marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '8px',
            borderLeft: `4px solid ${loading ? '#3498db' : '#2ecc71'}`
        }}>
          <p style={{ fontSize: '13px', color: '#34495e', margin: 0 }}>
            {isAdmin ? "✏️ Admin: Click điểm đầu, kéo chuột vẽ đoạn tắc" :
             !start ? "👉 Bước 1: Chọn điểm xuất phát" : 
             !end ? "👉 Bước 2: Chọn điểm đến" : 
             loading ? "⏳ Đang tính toán lộ trình tối ưu..." : "✅ Đường đi đã được cập nhật"}
          </p>
        </div>

        {(start || end) && !isAdmin && (
          <button 
            onClick={() => { setStart(null); setEnd(null); setPath([]); }}
            style={{
              marginTop: '15px', width: '100%', padding: '10px', background: '#e74c3c', 
              color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
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