import pickle
import random
from typing import List, Dict, Optional, Tuple
from functionApp.get_shogi_move import get_cpu_move, is_king_in_check, apply_move, get_piece_moves

def load_model(model_path: str):
    with open(model_path, 'rb') as f:
        return pickle.load(f)

def initialize_board() -> List[List[Optional[Dict]]]:
    board = [[None for _ in range(9)] for _ in range(9)]
    
    # 後手の駒を配置
    board[0] = [
        {"type": "香", "player": "後手"},
        {"type": "桂", "player": "後手"},
        {"type": "銀", "player": "後手"},
        {"type": "金", "player": "後手"},
        {"type": "王", "player": "後手"},
        {"type": "金", "player": "後手"},
        {"type": "銀", "player": "後手"},
        {"type": "桂", "player": "後手"},
        {"type": "香", "player": "後手"}
    ]
    board[1][1] = {"type": "飛", "player": "後手"}
    board[1][7] = {"type": "角", "player": "後手"}
    for i in range(9):
        board[2][i] = {"type": "歩", "player": "後手"}
    
    # 先手の駒を配置
    board[8] = [
        {"type": "香", "player": "先手"},
        {"type": "桂", "player": "先手"},
        {"type": "銀", "player": "先手"},
        {"type": "金", "player": "先手"},
        {"type": "王", "player": "先手"},
        {"type": "金", "player": "先手"},
        {"type": "銀", "player": "先手"},
        {"type": "桂", "player": "先手"},
        {"type": "香", "player": "先手"}
    ]
    board[7][1] = {"type": "角", "player": "先手"}
    board[7][7] = {"type": "飛", "player": "先手"}
    for i in range(9):
        board[6][i] = {"type": "歩", "player": "先手"}
    
    return board

def print_board(board: List[List[Optional[Dict]]]):
    piece_symbols = {
        "歩": "歩", "香": "香", "桂": "桂", "銀": "銀", "金": "金", "角": "角", "飛": "飛", "王": "玉",
        "と": "と", "成香": "杏", "成桂": "圭", "成銀": "全", "馬": "馬", "龍": "龍"
    }
    print("  9 8 7 6 5 4 3 2 1")
    print(" +-----------------+")
    for i, row in enumerate(board):
        print(f"{i+1}|", end="")
        for piece in row:
            if piece is None:
                print(" ・", end="")
            else:
                symbol = piece_symbols[piece['type']]
                if piece['player'] == "後手":
                    symbol = f"\033[31m{symbol}\033[0m"  # 後手の駒を赤色で表示
                print(f" {symbol}", end="")
        print("|")
    print(" +-----------------+")

def simulate_game(model_data_a, model_data_b):
    board = initialize_board()
    current_player = "先手"
    move_count = 0
    
    while True:
        print(f"\nMove {move_count + 1}:")
        print_board(board)
        print(f"{current_player}の番です")
        
        # 現在のプレイヤーに応じてモデルを選択
        current_model = model_data_a if current_player == "先手" else model_data_b
        
        move = get_cpu_move(board, current_player, current_model)
        if not move:
            print(f"{current_player}の有効な手がありません。")
            return "後手" if current_player == "先手" else "先手"
        
        board = apply_move(board, move, current_player)
        
        # 移動の表示を修正
        if isinstance(move, tuple) and len(move) >= 3:
            from_pos, to_pos, piece_type = move[:3]
            if isinstance(from_pos, tuple) and isinstance(to_pos, tuple):
                from_str = f"{9-from_pos[1]}{from_pos[0]+1}"
                to_str = f"{9-to_pos[1]}{to_pos[0]+1}"
                print(f"{current_player}の手: {from_str}{piece_type}{to_str}")
            else:
                print(f"{current_player}の手: {move}")
        else:
            print(f"{current_player}の手: {move}")
        
        if is_king_in_check(board, "先手" if current_player == "後手" else "後手"):
            print(f"{current_player}の勝利！")
            return current_player
        
        current_player = "後手" if current_player == "先手" else "先手"
        move_count += 1
        
        if move_count >= 300:  # 300手で引き分け
            print("300手に達しました。引き分けです。")
            return None
        
        # input("次の手に進むにはEnterキーを押してください...")  # ユーザーの入力を待つ

def main():
    model_path_a = 'functionApp/get_shogi_move/models/fog_shogi_cfr_iter_5000.pkl'
    model_path_b = 'functionApp/get_shogi_move/models/fog_shogi_cfr_iter_50000.pkl'  # Bのモデルパスを変更
    model_data_a = load_model(model_path_a)
    model_data_b = load_model(model_path_b)
    
    num_games = 1000
    wins = {"先手 (Model A)": 0, "後手 (Model B)": 0, "引き分け": 0}
    
    for game_num in range(num_games):
        print(f"\n=== ゲーム {game_num + 1} ===")
        winner = simulate_game(model_data_a, model_data_b)
        if winner:
            wins[f"{winner} ({'Model A' if winner == '先手' else 'Model B'})"] += 1
        else:
            wins["引き分け"] += 1
        
        # play_again = input("もう一度プレイしますか？ (y/n): ").lower()
        # if play_again != 'y':
            # break
    
    print(f"\nシミュレーション結果 ({game_num + 1}ゲーム):")
    print(f"先手 (Model A)の勝利: {wins['先手 (Model A)']} ({wins['先手 (Model A)']/(game_num + 1)*100:.2f}%)")
    print(f"後手 (Model B)の勝利: {wins['後手 (Model B)']} ({wins['後手 (Model B)']/(game_num + 1)*100:.2f}%)")
    print(f"引き分け: {wins['引き分け']} ({wins['引き分け']/(game_num + 1)*100:.2f}%)")

if __name__ == "__main__":
    main()