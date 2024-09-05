import sys
sys.setrecursionlimit(10000)  # Increase the limit, adjust as needed

import numpy as np
from typing import Dict, List, Tuple, Set
import os
import pickle

class FogShogiState:
    def __init__(self):
        # 9x9の盤面を初期化（0: 空、正: 先手の駒、負: 後手の駒）
        self.board = np.zeros((9, 9), dtype=int)
        self.turn = 1  # 1: 先手, -1: 後手
        self.hidden_info = {1: set(), -1: set()}  # 各プレイヤーに見えない駒の位置
        self.captured_pieces = {1: {}, -1: {}} # 持ち駒を管理する辞書
        self.promotion_zone = {1: [0, 1, 2], -1: [6, 7, 8]}  # 成れる領域

        # 初期配置（フル配置）
        self.initial_setup()

        # 霧の効果を適用
        self.update_fog()

    def initial_setup(self):
        # 後手の駒
        self.board[0] = [-2, -3, -4, -6, -8, -6, -4, -3, -2]  # 香、桂、銀、金、玉、金、銀、桂、香
        self.board[1, 1] = -7  # 飛車
        self.board[1, 7] = -5  # 角
        self.board[2] = -1  # 歩

        # 先手の駒
        self.board[8] = [2, 3, 4, 6, 8, 6, 4, 3, 2]  # 香、桂、銀、金、玉、金、銀、桂、香
        self.board[7, 1] = 5  # 角
        self.board[7, 7] = 7  # 飛車
        self.board[6] = 1  # 歩

    def update_fog(self):
        self.hidden_info = {1: set(), -1: set()}
        for i in range(9):
            for j in range(9):
                if not self.is_visible(i, j, 1):
                    self.hidden_info[1].add((i, j))
                if not self.is_visible(i, j, -1):
                    self.hidden_info[-1].add((i, j))

    def is_visible(self, i: int, j: int, player: int) -> bool:

        # プレイヤーの各駒からの視界をチェック
        for pi in range(9):
            for pj in range(9):
                if self.board[pi, pj] * player > 0:  # プレイヤーの駒
                    piece = abs(self.board[pi, pj])
                    if self.is_in_piece_vision(piece, pi, pj, i, j, player):
                        return True

        return False
    
    def is_in_piece_vision(self, piece: int, pi: int, pj: int, i: int, j: int, player: int) -> bool:
        moves = self.get_piece_moves(piece, pi, pj)
        for mi, mj in moves:
            if (mi, mj) == (i, j):
                return True
            if self.board[mi, mj] != 0:  # 駒がある場合、その先は見えない
                break
        return False

    def get_legal_actions(self) -> List[Tuple[int, int, int, int, bool]]:
        actions = []
        # 盤上の駒の移動
        for i in range(9):
            for j in range(9):
                if self.board[i, j] * self.turn > 0:  # 自分の駒
                    piece = abs(self.board[i, j])
                    moves = self.get_piece_moves(piece, i, j)
                    for ni, nj in moves:
                        if 0 <= ni < 9 and 0 <= nj < 9 and self.board[ni, nj] * self.turn <= 0:
                            if piece in [1, 2, 3, 4, 5, 7] and (i in self.promotion_zone[self.turn] or ni in self.promotion_zone[self.turn]):
                                actions.append((i, j, ni, nj, True))  # 成る
                            actions.append((i, j, ni, nj, False))  # 成らない

        # 持ち駒の使用
        for piece, count in self.captured_pieces[self.turn].items():
            if count > 0:
                for i in range(9):
                    for j in range(9):
                        if self.board[i, j] == 0 and self.is_visible(i, j, self.turn):
                            if piece != 1 or (piece == 1 and i > 0 and i < 8):  # 歩は一段目と九段目には打てない
                                if not self.is_two_pawns(piece, j):  # 二歩チェック
                                    actions.append((-1, piece, i, j, False))  # -1は持ち駒を表す特別な値

        return actions
    
    def is_two_pawns(self, piece: int, column: int) -> bool:
        if piece != 1:  # 歩以外の駒は二歩にならない
            return False
        for i in range(9):
            if self.board[i, column] * self.turn == 1:  # 同じ段に自分の歩がある
                return True
        return False

    def apply_action(self, action: Tuple[int, int, int, int, bool]):
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

    def get_piece_moves(self, piece: int, i: int, j: int) -> List[Tuple[int, int]]:
        moves = []
        directions = []
        if piece == 1:  # 歩
            directions = [(-1, 0)] if self.turn == 1 else [(1, 0)]
        elif piece == 2:  # 香車
            directions = [(-1, 0)] if self.turn == 1 else [(1, 0)]
        elif piece == 3:  # 桂馬
            return [(i - 2 * self.turn, j - 1), (i - 2 * self.turn, j + 1)]
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

    def apply_action(self, action: Tuple[int, int, int, int]):
        i, j, ni, nj = action
        self.board[ni, nj] = self.board[i, j]
        self.board[i, j] = 0
        self.turn *= -1  # 手番を交代
        self.update_fog()  # 霧の効果を更新

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

class FogShogiCFR:
    def __init__(self):
        self.regret_sum: Dict[str, Dict[Tuple[int, int, int, int], float]] = {}
        self.strategy_sum: Dict[str, Dict[Tuple[int, int, int, int], float]] = {}

    def get_information_set(self, state: FogShogiState) -> str:
        # プレイヤーから見える情報のみを使用して情報集合を生成
        visible_board = state.board.copy()
        for pos in state.hidden_info[state.turn]:
            visible_board[pos] = 0  # 見えない駒を0（空）に置き換え
        return f"{visible_board.tobytes()}{state.turn}"

    def get_strategy(self, info_set: str, actions: List[Tuple[int, int, int, int]]) -> Dict[Tuple[int, int, int, int], float]:
        if info_set not in self.regret_sum:
            self.regret_sum[info_set] = {action: 0.0 for action in actions}
            self.strategy_sum[info_set] = {action: 0.0 for action in actions}

        regrets = self.regret_sum[info_set]
        positive_regrets = {action: max(regret, 0) for action, regret in regrets.items()}
        sum_positive_regrets = sum(positive_regrets.values())

        if sum_positive_regrets > 0:
            strategy = {action: regret / sum_positive_regrets for action, regret in positive_regrets.items()}
        else:
            strategy = {action: 1.0 / len(actions) for action in actions}

        return strategy

    def cfr(self, state: FogShogiState, player: int, reach_probability: float, depth: int = 0, max_depth: int = 100) -> float:
        # if depth % 10 == 0:  # 10ステップごとに深さを表示
            # print(f"Current depth: {depth}")

        if state.is_terminal() or depth >= max_depth:
            return state.get_utility(player)

        info_set = self.get_information_set(state)
        actions = state.get_legal_actions()

        strategy = self.get_strategy(info_set, actions)
        for action in actions:
            self.strategy_sum[info_set][action] = self.strategy_sum[info_set].get(action, 0) + reach_probability * strategy[action]

        action_utilities = {}

        for action in actions:
            new_state = FogShogiState()
            new_state.board = np.copy(state.board)
            new_state.turn = state.turn
            new_state.hidden_info = {k: set(v) for k, v in state.hidden_info.items()}
            new_state.apply_action(action)

            if state.turn == player:
                action_utilities[action] = -self.cfr(new_state, player, reach_probability * strategy[action], depth + 1, max_depth)
            else:
                action_utilities[action] = -self.cfr(new_state, player, reach_probability, depth + 1, max_depth)

        utility = sum(strategy[action] * action_utilities[action] for action in actions)

        if state.turn == player:
            for action in actions:
                self.regret_sum[info_set][action] = self.regret_sum[info_set].get(action, 0) + \
                    reach_probability * (action_utilities[action] - utility)

        return utility

    def train(self, iterations: int):
        for i in range(iterations):
            if i % 100 == 0:  # 100イテレーションごとに進捗を表示
                print(f"Training iteration: {i}")
            state = FogShogiState()  # 初期状態を生成
            self.cfr(state, 1, 1.0)
            self.cfr(state, -1, 1.0)

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

    def train_and_save(self, iterations: int, save_interval: int, filename: str):
        for i in range(iterations):
            if i % 10 == 0:  # 10イテレーションごとに進捗を表示
                print(f"イテレーション {i}/{iterations}")
            state = FogShogiState()
            self.cfr(state, 1, 1.0, max_depth=20)
            self.cfr(state, -1, 1.0, max_depth=20)

            if (i + 1) % save_interval == 0:
                self.save_model(f"{filename}_iter_{i+1}.pkl")
                print(f"{i+1} イテレーション完了")

# 使用例
def train_new_model():
    cfr_model = FogShogiCFR()
    cfr_model.train_and_save(iterations=5, save_interval=5, filename="fog_shogi_cfr")

def use_existing_model():
    cfr_model = FogShogiCFR.load_model("fog_shogi_cfr_iter_10000.pkl")
    
    # モデルを使用して最適な行動を選択する例
    state = FogShogiState()  # ゲームの現在の状態
    info_set = cfr_model.get_information_set(state)
    actions = state.get_legal_actions()
    strategy = cfr_model.get_average_strategy(info_set)
    best_action = max(strategy, key=strategy.get)
    print(f"最適な行動: {best_action}")

if __name__ == "__main__":
    # 新しいモデルを学習
    train_new_model()
    # 既存のモデルを使用
    use_existing_model()