import heapq
import os
import sys
from collections import defaultdict

# Thêm đường dẫn gốc của project
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.utils.geo_utils import haversine_distance

class AStarSolver:
    def __init__(self, graph, nodes):
        """
        graph: Adjacency list {u: {v: edge_data}}
        nodes: Tọa độ {node_id: (lat, lon)}
        """
        self.graph = graph
        self.nodes = nodes
        self.INF_THRESHOLD = 999999.0

    def heuristic(self, u, v):
        """Hàm h(n): Khoảng cách chim bay"""
        try:
            lat1, lon1 = self.nodes[u]
            lat2, lon2 = self.nodes[v]
            return haversine_distance(lat1, lon1, lat2, lon2)
        except (KeyError, TypeError):
            return self.INF_THRESHOLD

    def solve(self, start_node, goal_node, cost_fn=None, return_history=False):
        """
        Tìm đường đi tối ưu A* với chi phí động.
        Thêm tham số return_history: Nếu True, trả về (path, visited_order)
        """
        if start_node not in self.nodes or goal_node not in self.nodes:
            print(f"Lỗi: Node {start_node} hoặc {goal_node} không tồn tại trong dữ liệu.")
            return (None, []) if return_history else None

        open_set = []
        heapq.heappush(open_set, (0, start_node))
        came_from = {}
        
        g_score = defaultdict(lambda: float('inf'))
        g_score[start_node] = 0

        f_score = defaultdict(lambda: float('inf'))
        f_score[start_node] = self.heuristic(start_node, goal_node)

        closed_set = set()
        
        # 🟢 Mảng lưu trữ thứ tự các Node đã được khám phá
        visited_order = []

        while open_set:
            current_f, current = heapq.heappop(open_set)

            # Bỏ qua nếu node đã được duyệt qua từ một đường ngắn hơn trước đó
            if current in closed_set:
                continue
            
            # 🟢 Ghi vào nhật ký: Thuật toán quyết định "đứng" tại Node này để nhìn xung quanh
            if return_history:
                visited_order.append(current)

            # Nếu đã đến đích
            if current == goal_node:
                path = self._reconstruct_path(came_from, current)
                if return_history:
                    return path, visited_order
                return path

            closed_set.add(current)
            neighbors = self.graph.get(current, {})
            u_coord = self.nodes[current]

            for neighbor, edge_data in neighbors.items():
                if neighbor in closed_set:
                    continue

                v_coord = self.nodes[neighbor]

                if cost_fn:
                    weight = cost_fn(current, neighbor, u_coord, v_coord, edge_data)
                else:
                    weight = edge_data.get('weight', self.heuristic(current, neighbor))

                if weight >= self.INF_THRESHOLD:
                    continue

                tentative_g_score = g_score[current] + weight

                if tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    
                    h_n = self.heuristic(neighbor, goal_node)
                    f_score[neighbor] = tentative_g_score + h_n
                    
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))

        # Trả về kết quả khi không tìm thấy đường
        if return_history:
            return None, visited_order
        return None

    def _reconstruct_path(self, came_from, current):
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        return path[::-1]