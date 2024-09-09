import os
from joblib import Parallel, delayed
import multiprocessing
from functools import partial
import sys
sys.setrecursionlimit(100000)  # 再帰の深さ制限を増やす（必要に応じて調整）

import time
import random
import numpy as np
from typing import Dict, List, Tuple, Set, Optional
import os
import pickle
from tqdm import tqdm
import psutil

class FogShogiState:
    def __init__(self):
        # 9x9の盤面を初期化（0: 空、正: 先手の駒、負: 後手の駒）
        self.board = np.zeros((9, 9), dtype=int)
        self.turn = 1  # 1: 先手, -1: 後手
        self.hidden_info = {1: set(), -1: set()}  # 各プレイヤーに見えない駒の位置
        self.captured_pieces = {1: {}, -1: {}} # 持ち駒を管理する辞書
        self.promotion_zone = {1: [0, 1, 2], -1: [6, 7, 8]}  # 成れる領域
        self.in_check = False  # プレイヤーが王手されているかどうかを示すフラグ

        # 初期配置（フル配置）
        self.initial_setup()

        # 霧の効果を適用
        self.update_fog()

    def initial_setup(self):
        # 後手の駒を配置
        self.board[0] = [-2, -3, -4, -6, -8, -6, -4, -3, -2]  # 香、桂、銀、金、玉、金、銀、桂、香
        self.board[1, 1] = -7  # 飛車
        self.board[1, 7] = -5  # 角
        self.board[2] = -1  # 歩

        # 先手の駒を配置
        self.board[8] = [2, 3, 4, 6, 8, 6, 4, 3, 2]  # 香、桂、銀、金、玉、金、銀、桂、香
        self.board[7, 1] = 5  # 角
        self.board[7, 7] = 7  # 飛車
        self.board[6] = 1  # 歩

    def update_fog(self):
        # 霧の効果を更新する
        self.hidden_info = {1: set(), -1: set()}
        for i in range(9):
            for j in range(9):
                if not self.is_visible(i, j, 1):
                    self.hidden_info[1].add((i, j))
                if not self.is_visible(i, j, -1):
                    self.hidden_info[-1].add((i, j))
        self.in_check = self.is_in_check(self.turn)  # 現在のプレイヤーが王手されているかを更新

    def is_visible(self, i: int, j: int, player: int) -> bool:
        # 指定された位置がプレイヤーから見えるかどうかを判定する

        # プレイヤーの各駒からの視界をチェック
        for pi in range(9):
            for pj in range(9):
                if self.board[pi, pj] * player > 0:  # プレイヤーの駒
                    piece = abs(self.board[pi, pj])
                    if self.is_in_piece_vision(piece, pi, pj, i, j, player):
                        return True

        return False
    
    def is_in_piece_vision(self, piece: int, pi: int, pj: int, i: int, j: int, player: int) -> bool:
        # 指定された駒の視界内に目標の位置があるかどうかを判定する
        moves = self.get_piece_moves(piece, pi, pj)
        for mi, mj in moves:
            if (mi, mj) == (i, j):
                return True
            if self.board[mi, mj] != 0:  # 駒がある場合、その先は見えない
                break
        return False

    def get_legal_actions(self) -> List[Tuple[int, int, int, int, bool]]:
        # 合法手のリストを取得する
        actions = []
        # 盤上の駒の移動
        for i in range(9):
            for j in range(9):
                if self.board[i, j] * self.turn > 0:  # 自分の駒
                    piece = abs(self.board[i, j])
                    moves = self.get_piece_moves(piece, i, j)
                    for ni, nj in moves:
                        if 0 <= ni < 9 and 0 <= nj < 9 and self.board[ni, nj] * self.turn <= 0:
                            # 移動先が盤面内かつ自分の駒でない
                            if piece in [1, 2, 3, 4, 5, 7] and (i in self.promotion_zone[self.turn] or ni in self.promotion_zone[self.turn]):
                                actions.append((i, j, ni, nj, True))  # 成る
                            actions.append((i, j, ni, nj, False))  # 成らない

        # 持ち駒の使用
        for piece, count in self.captured_pieces[self.turn].items():
            if count > 0:
                for i in range(9):
                    for j in range(9):
                        if self.board[i, j] == 0 and self.is_visible(i, j, self.turn):
                            if piece != 1 or (piece == 1 and 0 < i < 8):  # 歩は一段目と九段目には打てない
                                if not self.is_two_pawns(piece, j):  # 二歩チェック
                                    if not (piece == 1 and self.is_pawn_drop_mate(i, j)):  # 打ち歩詰めチェック
                                        actions.append((-1, piece, i, j, False))  # -1は持ち駒を表す特別な値

        # 王手を回避できないアクションを除外
        legal_actions = []
        for action in actions:
            new_state = FogShogiState()
            new_state.board = np.copy(self.board)
            new_state.turn = self.turn
            new_state.hidden_info = {k: set(v) for k, v in self.hidden_info.items()}
            new_state.captured_pieces = {k: dict(v) for k, v in self.captured_pieces.items()}
            new_state.apply_action(action)
            if not new_state.is_in_check(self.turn):
                legal_actions.append(action)

        return legal_actions
    
    def is_two_pawns(self, piece: int, column: int) -> bool:
        # 二歩の判定を行う
        if piece != 1:  # 歩以外の駒は二歩にならない
            return False
        for i in range(9):
            if self.board[i, column] * self.turn == 1:  # 同じ段に自分の歩がある
                return True
        return False
    
    def is_pawn_drop_mate(self, i: int, j: int) -> bool:
        # 打ち歩詰めのチェックを行う
        opponent_king_pos = self.find_king(-self.turn)
        if opponent_king_pos is None:
            return False  # 相手の玉がない場合は打ち歩詰めにならない

        ki, kj = opponent_king_pos
        if abs(ki - i) > 1 or abs(kj - j) > 1:
            return False  # 打った歩が相手の玉の周囲でない場合は打ち歩詰めにならない

        # 歩を打った後の状態をシミュレート
        self.board[i, j] = self.turn
        is_mate = self.is_checkmate(-self.turn)
        self.board[i, j] = 0  # 元に戻す

        return is_mate

    def find_king(self, player: int) -> Optional[Tuple[int, int]]:
        # プレイヤーの玉の位置を探す
        for i in range(9):
            for j in range(9):
                if self.board[i, j] == 8 * player:
                    return (i, j)
        return None

    def is_checkmate(self, player: int) -> bool:
        # 詰みの判定を行う
        king_pos = self.find_king(player)
        if king_pos is None:
            return False  # 玉がない場合は詰みではない

        # 玉の移動可能な位置をチェック
        ki, kj = king_pos
        for di in [-1, 0, 1]:
            for dj in [-1, 0, 1]:
                if di == 0 and dj == 0:
                    continue
                ni, nj = ki + di, kj + dj
                if 0 <= ni < 9 and 0 <= nj < 9 and self.board[ni, nj] * player <= 0:
                    if not self.is_square_attacked(ni, nj, -player):
                        return False  # 玉が移動できる安全な場所がある

        # 他の駒で王手を防げるかチェック
        for i in range(9):
            for j in range(9):
                if self.board[i, j] * player > 0:
                    piece = abs(self.board[i, j])
                    moves = self.get_piece_moves(piece, i, j)
                    for mi, mj in moves:
                        if 0 <= mi < 9 and 0 <= mj < 9 and self.board[mi, mj] * player <= 0:
                            # 駒を移動してみて、王手が防げるかチェック
                            original_piece = self.board[mi, mj]
                            self.board[mi, mj] = self.board[i, j]
                            self.board[i, j] = 0
                            is_safe = not self.is_square_attacked(ki, kj, -player)
                            # 元に戻す
                            self.board[i, j] = self.board[mi, mj]
                            self.board[mi, mj] = original_piece
                            if is_safe:
                                return False  # 王手を防げる手がある

        return True  # 詰み

    def is_square_attacked(self, i: int, j: int, attacker: int) -> bool:
        # 指定されたマスが攻撃されているかどうかを判定する
        for ai in range(9):
            for aj in range(9):
                if self.board[ai, aj] * attacker > 0:
                    piece = abs(self.board[ai, aj])
                    moves = self.get_piece_moves(piece, ai, aj)
                    if (i, j) in moves:
                        return True
        return False

    def apply_action(self, action: Tuple[int, int, int, int, bool]):
        # アクションを適用し、盤面を更新する
        i, j, ni, nj, promote = action
        if i == -1:  # 持ち駒を使用する場合
            piece = j
            self.board[ni, nj] = piece * self.turn
            self.captured_pieces[self.turn][piece] -= 1
            if self.captured_pieces[self.turn][piece] == 0:
                del self.captured_pieces[self.turn][piece]
        else:
            captured_piece = abs(self.board[ni, nj])
            if captured_piece != 0:
                self.captured_pieces[self.turn][captured_piece] = self.captured_pieces[self.turn].get(captured_piece, 0) + 1
            
            moving_piece = abs(self.board[i, j])
            if promote:
                self.board[ni, nj] = (moving_piece + 10) * self.turn  # 成った駒は元の駒の値+10とする
            else:
                self.board[ni, nj] = self.board[i, j]
            self.board[i, j] = 0

        self.turn *= -1  # 手番を交代
        self.update_fog()  # 霧の効果を更新
        if self.in_check:
            print(f"Player {self.turn} is in check!")  # 王手の通知

    def get_piece_moves(self, piece: int, i: int, j: int) -> List[Tuple[int, int]]:
        # 指定された駒の移動可能な位置のリストを取得する
        moves = []
        directions = []
        if piece == 1:  # 歩
            directions = [(-1, 0)] if self.turn == 1 else [(1, 0)]
        elif piece == 2:  # 香車
            directions = [(-1, 0)] if self.turn == 1 else [(1, 0)]
        elif piece == 3:  # 桂馬
            potential_moves = [(i - 2 * self.turn, j - 1), (i - 2 * self.turn, j + 1)]
            return [(ni, nj) for ni, nj in potential_moves if 0 <= ni < 9 and 0 <= nj < 9]
        elif piece == 4:  # 銀
            directions = [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 1)]
        elif piece == 5:  # 角
            directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        elif piece == 6:  # 金
            directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0)]
        elif piece == 7:  # 飛車
            directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        elif piece == 8:  # 玉
            directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
        elif piece > 10:  # 成り駒
            if piece in [11, 12, 13, 14]:  # 成り金（と金、杏、圭、全）
                directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0)]
            elif piece == 15:  # 馬（成り角）
                directions = [(-1, -1), (-1, 1), (1, -1), (1, 1), (-1, 0), (1, 0), (0, -1), (0, 1)]
            elif piece == 17:  # 龍（成り飛車）
                directions = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]

        for di, dj in directions:
            ni, nj = i + di, j + dj
            while 0 <= ni < 9 and 0 <= nj < 9:
                moves.append((ni, nj))
                if self.board[ni, nj] != 0 or piece in [1, 3, 4, 6, 8, 11, 12, 13, 14]:  # 1マスだけ動く駒
                    break
                ni, nj = ni + di, nj + dj

        return moves

    def is_terminal(self) -> bool:
        # 王が取られたらゲーム終了
        return 8 not in self.board and -8 not in self.board

    def get_utility(self, player: int) -> float:
        if 8 not in self.board:
            return -1 if player == 1 else 1
        elif -8 not in self.board:
            return 1 if player == 1 else -1
        else:
            return 0

    def is_in_check(self, player: int) -> bool:
        king_pos = self.find_king(player)
        if king_pos is None:
            return False  # 玉がない場合は王手ではない
        ki, kj = king_pos
        return self.is_square_attacked(ki, kj, -player)

class FogShogiCFR:
    def __init__(self):
        self.cache: Dict[str, float] = {}
        self.max_cache_size = 100000000
        self.cache_cleanup_threshold = 0.8
        self.regret_sum: Dict[str, Dict[Tuple[int, int, int, int], float]] = {}
        self.strategy_sum: Dict[str, Dict[Tuple[int, int, int, int], float]] = {}

    def get_information_set(self, state: FogShogiState) -> str:
        # より詳細な情報を含める
        visible_board = state.board.copy()
        for pos in state.hidden_info[state.turn]:
            visible_board[pos] = -1  # 見えない駒を-1で表現
        return f"{visible_board.tobytes()}{state.turn}{state.captured_pieces}"

    def get_strategy(self, info_set: str, actions: List[Tuple[int, int, int, int]]) -> Dict[Tuple[int, int, int, int], float]:
        # 既存の初期化部分を保持
        if info_set not in self.regret_sum:
            self.regret_sum[info_set] = {action: 0.0 for action in actions}
            self.strategy_sum[info_set] = {action: 0.0 for action in actions}

        t = sum(self.strategy_sum[info_set].values()) + 1
        c = 2  # 探索の程度を制御するパラメータ。この値は調整可能です。
        ucb_values = {}

        for action in actions:
            q = self.strategy_sum[info_set].get(action, 0) / (self.regret_sum[info_set].get(action, 0) + 1)
            n = self.regret_sum[info_set].get(action, 0) + 1
            ucb_values[action] = q + c * np.sqrt(np.log(t) / n)
        
        total = sum(ucb_values.values())
        
        # 合計が0の場合（すべての行動のUCB値が0の場合）の処理
        if total == 0:
            return {action: 1.0 / len(actions) for action in actions}
        
        return {action: value / total for action, value in ucb_values.items()}

    def parallel_cfr(self, player: int, num_processes: int = 32, iterations: int = 1000, batch_size: int = 100):
        results = []
        utilities = []
        
        # tqdmを使用してプログレスバーを表示
        for batch_start in tqdm(range(0, iterations, batch_size), desc="Batch Progress"):
            batch_end = min(batch_start + batch_size, iterations)
            batch_iterations = batch_end - batch_start
            
            # バッチ内の反復処理を並列実行
            batch_results = Parallel(n_jobs=num_processes, verbose=0)(
                delayed(self.cfr_iteration)(iteration, player)
                for iteration in range(batch_start, batch_end)
            )
            
            results.extend(batch_results)
            
            # バッチの平均ユーティリティを計算
            batch_avg_utility = np.mean(batch_results)
            utilities.append(batch_avg_utility)
            
            # 中間結果の表示
            print(f"\nBatch {batch_start//batch_size + 1} completed:")
            print(f"  Iterations: {batch_start+1}-{batch_end}")
            print(f"  Batch Average Utility: {batch_avg_utility:.4f}")
            
            # 定期的にモデルを保存
            if (batch_start + batch_size) % (batch_size * 10) == 0:
                self.save_model(f"fog_shogi_cfr_player{player}_iter_{batch_end}.pkl")
            
            # メモリ使用量の最適化（必要に応じて）
            self.optimize_memory()
        
        # 全体の結果を集計
        total_utility = sum(results)
        average_utility = total_utility / iterations
        max_utility = max(results)
        min_utility = min(results)
        
        print(f"\nPlayer {player} CFR Results:")
        print(f"  Total Utility: {total_utility}")
        print(f"  Average Utility: {average_utility:.4f}")
        print(f"  Max Utility: {max_utility}")
        print(f"  Min Utility: {min_utility}")
        
        # 収束の指標として、最後の10%のイテレーションの平均を計算
        last_10_percent = results[-int(iterations * 0.1):]
        last_10_percent_avg = sum(last_10_percent) / len(last_10_percent)
        print(f"  Last 10% Average Utility: {last_10_percent_avg:.4f}")
        
        # ユーティリティの変化の要約を表示
        print("\nUtility Summary:")
        print(f"  Initial: {utilities[0]:.4f}")
        print(f"  Final: {utilities[-1]:.4f}")
        print(f"  Improvement: {utilities[-1] - utilities[0]:.4f}")
        
        return average_utility

    def optimize_memory(self):
        # キャッシュのクリーンアップなど、メモリ最適化のロジックをここに実装
        if len(self.cache) > self.max_cache_size:
            num_to_remove = int(self.max_cache_size * 0.3)
            for _ in range(num_to_remove):
                self.cache.popitem()

    def cfr_iteration(self, iteration: int, player: int):
        state = FogShogiState()
        result = self.cfr(state, player, 1.0, max_depth=8)
        if iteration % 5 == 0:  # 5イテレーションごとに進捗を表示
            print(f"Iteration: {iteration}, Player: {player}", end='\r')
            sys.stdout.flush()
        return result

    def cfr(self, state: FogShogiState, player: int, reach_probability: float, depth: int = 0, max_depth: int = 6) -> float:
        if depth % 10 == 0:
            print(f"Current depth: {depth}, Player: {player}", end='\r')
            sys.stdout.flush()

        if state.is_terminal():
            return state.get_utility(player)
        
        if depth >= max_depth:
            return self.evaluate_position(state, player)  # 評価関数の結果を返す

        info_set = self.get_information_set(state)
        
        cache_key = f"{info_set}_{player}_{depth}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        actions = state.get_legal_actions()
        if not actions:
            return 0

        strategy = self.get_strategy(info_set, actions)
        action_utilities = {}

        for action in actions:
            new_state = FogShogiState()
            new_state.board = np.copy(state.board)
            new_state.turn = state.turn
            new_state.hidden_info = {k: set(v) for k, v in state.hidden_info.items()}
            new_state.captured_pieces = {k: dict(v) for k, v in state.captured_pieces.items()}
            new_state.apply_action(action)

            action_utilities[action] = -self.cfr(new_state, player, reach_probability * strategy[action], depth + 1, max_depth)

        utility = sum(strategy[action] * action_utilities[action] for action in actions)

        # 評価関数の結果を学習に反映
        if state.turn == player:
            for action in actions:
                regret = reach_probability * (action_utilities[action] - utility)
                learning_rate = 0.1  # 学習率を追加
                self.regret_sum[info_set][action] = self.regret_sum[info_set].get(action, 0) + regret * learning_rate
                self.strategy_sum[info_set][action] = self.strategy_sum[info_set].get(action, 0) + reach_probability * strategy[action] * learning_rate

        self.cache[cache_key] = utility
        return utility
    
    
    def evaluate_position(self, state: FogShogiState, player: int) -> float:
        # 霧将棋用に調整された駒の基本価値
        piece_values = {
            1: 100,   # 歩
            2: 400,   # 香
            3: 450,   # 桂
            4: 500,   # 銀
            5: 800,   # 角
            6: 600,   # 金
            7: 900,   # 飛
            8: 15000, # 玉：さらに高い価値を設定
            11: 200,  12: 500, 13: 550, 14: 600, 15: 1000, 17: 1100  # 成り駒の価値を上げる
        }
        
        score = 0
        visible_pieces = {1: 0, -1: 0}
        king_pos = {1: None, -1: None}
        
        # 盤上の駒の評価
        for i in range(9):
            for j in range(9):
                piece = state.board[i, j]
                if piece != 0:
                    piece_player = 1 if piece > 0 else -1
                    abs_piece = abs(piece)
                    
                    # 基本点数
                    value = piece_values[abs_piece]
                    score += value * piece_player
                    
                    # 駒の位置による追加評価
                    position_bonus = self.get_position_bonus(abs_piece, i, j, piece_player)
                    score += position_bonus * piece_player
                    
                    # 可視駒のカウント
                    if (i, j) not in state.hidden_info[player]:
                        visible_pieces[piece_player] += 1
                    
                    # 王の位置を記録
                    if abs_piece == 8:
                        king_pos[piece_player] = (i, j)
        
        # 可視駒の割合による評価（情報の優位性）
        visibility_score = (visible_pieces[player] - visible_pieces[-player]) * 50
        score += visibility_score
        
        # 王の安全性評価（霧の中での位置も考慮）
        for p in [1, -1]:
            if king_pos[p]:
                ki, kj = king_pos[p]
                king_safety = sum(1 for di in [-1, 0, 1] for dj in [-1, 0, 1]
                                  if 0 <= ki+di < 9 and 0 <= kj+dj < 9 and 
                                  ((ki+di, kj+dj) in state.hidden_info[player] or state.board[ki+di][kj+dj] * p > 0))
                score += king_safety * 40 * p  # 霧も安全性として評価
        
        # 持ち駒の評価（霧将棋では持ち駒の価値が上がる可能性がある）
        for p in [1, -1]:
            for piece, count in state.captured_pieces[p].items():
                score += piece_values[piece] * count * 0.9 * p  # 持ち駒の価値を90%に設定
        
        # 中央支配の評価（情報収集の観点から重要）
        center_control = sum(1 for i in range(3, 6) for j in range(3, 6) 
                             if state.board[i][j] * player > 0) * 30
        score += center_control
        
        # 駒の危険度評価を追加
        for i in range(9):
            for j in range(9):
                piece = state.board[i, j]
                if piece * player > 0:  # プレイヤーの駒
                    danger_score = self.evaluate_piece_danger(state, i, j, player)
                    score -= danger_score * piece_values[abs(piece)] * 0.1  # 危険度に応じてスコアを減少

        # 攻撃の機会の評価を追加
        attack_opportunities = self.evaluate_attack_opportunities(state, player)
        score += attack_opportunities * 50  # 攻撃の機会にボーナスを与える
        
        # プレイヤーの視点から正規化（-1から1の範囲に）
        return np.tanh(score * player / 6000)  # 正規化係数を調整

    def evaluate_piece_danger(self, state: FogShogiState, i: int, j: int, player: int) -> float:
        danger = 0
        for di in [-1, 0, 1]:
            for dj in [-1, 0, 1]:
                if di == 0 and dj == 0:
                    continue
                ni, nj = i + di, j + dj
                if 0 <= ni < 9 and 0 <= nj < 9:
                    if state.board[ni, nj] * player < 0:  # 敵の駒
                        danger += 1  # 隣接する敵の駒の数をカウント
        return danger

    def evaluate_attack_opportunities(self, state: FogShogiState, player: int) -> int:
        opportunities = 0
        for i in range(9):
            for j in range(9):
                if state.board[i, j] * player > 0:  # プレイヤーの駒
                    piece = abs(state.board[i, j])
                    moves = state.get_piece_moves(piece, i, j)
                    for mi, mj in moves:
                        if state.board[mi, mj] * player < 0:  # 敵の駒を取れる
                            opportunities += 1
        return opportunities
    
    def get_position_bonus(self, piece: int, i: int, j: int, player: int) -> float:
        # 駒の位置による追加ボーナスを計算
        bonus = 0
        if player == 1:  # 先手
            bonus += (9 - i) * 10  # 相手陣地に近いほど価値が上がる
        else:  # 後手
            bonus += i * 10  # 相手陣地に近いほど価値が上がる
        
        # 中央にある駒にボーナス
        if 2 <= j <= 6:
            bonus += 20
        
        # 特定の駒に対する追加ボーナス
        if piece in [5, 7]:  # 角と飛車
            bonus += 50  # 重要な駒なので追加ボーナス
        elif piece in [15, 17]:  # 馬と龍
            bonus += 100  # さらに重要な成り駒なので高いボーナス
        
        return bonus
            
    def train_parallel(self, iterations: int, num_processes: int, save_interval: int, filename: str):
        start_time = time.time()
        for i in range(0, iterations, save_interval):
            print(f"\nイテレーション {i+1}-{min(i+save_interval, iterations)}/{iterations} 開始")
            
            print("先手のCFR開始")
            avg_utility_player1 = self.parallel_cfr(1, num_processes, save_interval)
            print("先手のCFR完了")
            
            print("後手のCFR開始")
            avg_utility_player2 = self.parallel_cfr(-1, num_processes, save_interval)
            print("後手のCFR完了")
            
            print(f"Average Utility - Player 1: {avg_utility_player1:.4f}, Player -1: {avg_utility_player2:.4f}")
            
            self.save_model(f"{filename}_iter_{i+save_interval}.pkl")
            print(f"{i+save_interval} イテレーション完了")

            if i % 10 == 0:
                monitor_resources()
            
            # キャッシュのクリーンアップ
            if len(self.cache) > self.max_cache_size:
                num_to_remove = int(self.max_cache_size * 0.3)
                for _ in range(num_to_remove):
                    self.cache.popitem()

        end_time = time.time()
        print(f"トレーニング完了 (総所要時間: {end_time - start_time:.2f}秒)")

    def get_average_strategy(self, info_set: str) -> Dict[Tuple[int, int, int, int], float]:
        strategy_sum = self.strategy_sum[info_set]
        total = sum(strategy_sum.values())
        if total > 0:
            return {action: count / total for action, count in strategy_sum.items()}
        else:
            return {action: 1.0 / len(strategy_sum) for action in strategy_sum}

    def save_model(self, filename: str):
        """モデルをpickle形式でファイルに保存する"""
        if not os.path.exists('models'):
            os.makedirs('models')
        
        path = os.path.join('models', filename)
        with open(path, 'wb') as f:
            pickle.dump({
                'regret_sum': self.regret_sum,
                'strategy_sum': self.strategy_sum
            }, f)
        print(f"モデルを {path} に保存しました。")

    @classmethod
    def load_model(cls, filename: str):
        """pickle形式のファイルからモデルを読み込む"""
        path = os.path.join('models', filename)
        if not os.path.exists(path):
            raise FileNotFoundError(f"モデルファイル {path} が見つかりません。")

        with open(path, 'rb') as f:
            data = pickle.load(f)
        
        model = cls()
        model.regret_sum = data['regret_sum']
        model.strategy_sum = data['strategy_sum']
        print(f"モデルを {path} から読み込みました。")
        return model

def monitor_resources():
    print(f"CPU Usage: {psutil.cpu_percent()}%")
    print(f"Memory Usage: {psutil.virtual_memory().percent}%")

# 使用例
def train_new_model():
    cfr_model = FogShogiCFR()
    num_processes = os.cpu_count()  # 利用可能なCPUコア数
    # num_processes = 48
    print(f"num_processes: {num_processes}")
    cfr_model.train_parallel(iterations=1000, num_processes=num_processes, save_interval=100, filename="fog_shogi_cfr")

if __name__ == "__main__":
    train_new_model()