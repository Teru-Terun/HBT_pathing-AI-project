import heapq
import os
import sys
from collections import defaultdict

# Thêm đường dẫn gốc của project
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

class DijkstraSolver:
    def __init__(self, graph, nodes):
        """
        graph: Adjacency list {u: {v: edge_data}}
        nodes: Tọa độ {node_id: (lat, lon)}
        """
        self.graph = graph
        self.nodes = nodes
        self.INF_THRESHOLD = 999999.0

    def solve(self, start_node, goal_node, cost_fn=None, return_history=False):
        """
        Tìm đường đi ngắn nhất bằng Dijkstra.
        """
        if start_node not in self.nodes or goal_node not in self.nodes:
            print(f"Lỗi: Node {start_node} hoặc {goal_node} không tồn tại.")
            return (None, []) if return_history else None

        # Priority Queue lưu (g_score, current_node)
        open_set = []
        heapq.heappush(open_set, (0, start_node))
        
        came_from = {}
        
        # g_score: Khoảng cách thực tế tích lũy từ điểm xuất phát
        g_score = defaultdict(lambda: float('inf'))
        g_score[start_node] = 0
        
        closed_set = set()
        visited_order = [] # Nhật ký loang màu

        while open_set:
            current_g, current = heapq.heappop(open_set)

            # Bỏ qua nếu node đã được chốt (tránh duyệt lại)
            if current in closed_set:
                continue
                
            if return_history:
                visited_order.append(current)

            # Nếu đã đến đích
            if current == goal_node:
                path = self._reconstruct_path(came_from, current)
                return (path, visited_order) if return_history else path

            closed_set.add(current)
            neighbors = self.graph.get(current, {})
            u_coord = self.nodes[current]

            for neighbor, edge_data in neighbors.items():
                if neighbor in closed_set:
                    continue

                v_coord = self.nodes[neighbor]

                # Tính trọng số cạnh
                if cost_fn:
                    weight = cost_fn(current, neighbor, u_coord, v_coord, edge_data)
                else:
                    weight = edge_data.get('weight', 1.0) # Mặc định

                # Chặn đường ngập lụt
                if weight >= self.INF_THRESHOLD:
                    continue

                tentative_g_score = g_score[current] + weight

                # Nếu tìm thấy đường ngắn hơn để đến neighbor này
                if tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    
                    heapq.heappush(open_set, (tentative_g_score, neighbor))

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