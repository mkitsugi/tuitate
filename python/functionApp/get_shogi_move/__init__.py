import azure.functions as func
import json
import pickle
import os
import logging
import random
import numpy as np
from typing import List, Tuple, Dict, Optional

# モデルデータの読み込み
model_path = os.path.join(os.path.dirname(__file__), 'models', 'fog_shogi_cfr_iter_5000.pkl')
logging.info(f"Attempting to load model from: {model_path}")

# モデルファイルの存在確認と読み込み
if os.path.exists(model_path):
    logging.info("Model file found. Attempting to load...")
    with open(model_path, 'rb') as f:
        model_data = pickle.load(f)
    logging.info("Model loaded successfully.")
else:
    logging.error(f"Model file not found at: {model_path}")
    raise FileNotFoundError(f"Model file not found at: {model_path}")

def get_information_set(board, player):
    # ボードの状態を文字列に変換
    board_string = ''.join([
        ''.join([
            str(get_piece_value(cell['type'], cell['player'])) if cell else '0'
            for cell in row
        ])
        for row in board
    ])
    # プレイヤーを1か-1に変換
    player_value = 1 if player == "先手" else -1
    return f"{board_string}|{player_value}"

def get_piece_value(piece_type, player):
    # 駒の種類に応じて数値を割り当て
    piece_values = {
        "歩": 1, "香": 2, "桂": 3, "銀": 4, "金": 6, "角": 5, "飛": 7, "王": 8,
        "と": 11, "成香": 12, "成桂": 13, "成銀": 14, "馬": 15, "龍": 17
    }
    value = piece_values.get(piece_type, 0)
    # 後手の場合は負の値を返す
    return value if player == "先手" else -value

def get_average_strategy(info_set, model_data):
    # 情報集合に対する戦略の合計を取得
    strategy_sum = model_data['strategy_sum'].get(info_set, {})
    normalized_sum = sum(strategy_sum.values())
    
    if normalized_sum > 0:
        # 正規化された戦略を返す
        return {action: sum / normalized_sum for action, sum in strategy_sum.items()}
    else:
        # 戦略が存在しない場合は一様分布を返す
        actions = list(strategy_sum.keys())
        uniform_prob = 1 / len(actions) if actions else 0
        return {action: uniform_prob for action in actions}

def get_cpu_move(board, player, model_data=model_data):
    # 現在の盤面の情報集合を取得
    info_set = get_information_set(board, player)
    # 情報集合に対する戦略を取得
    strategy = get_average_strategy(info_set, model_data)
    
    # 合法手を取得
    actions = get_legal_actions(board, player)
    
    if not actions:
        return None  # 合法手が全くない場合

    if strategy:
        # 戦略に含まれる合法手のみを抽出
        valid_actions = [action for action in actions if action in strategy]
        if valid_actions:
            # 最も確率の高い行動を選択
            return max(valid_actions, key=lambda a: strategy.get(a, 0))
    
    # 戦略がない場合や有効な行動がない場合はランダムな合法手を返す
    return random.choice(actions)

def get_legal_actions(board, player):
    actions = []
    for i in range(9):
        for j in range(9):
            piece = board[i][j]
            if piece and piece['player'] == player:
                # 各駒の可能な移動先を取得
                moves = get_piece_moves(piece['type'], i, j, player, board)
                for ni, nj in moves:
                    # 移動先に自分の駒がないことを確認
                    if board[ni][nj] is None or board[ni][nj]['player'] != player:
                        actions.append((i, j, ni, nj))
    return actions

def get_piece_moves(piece_type, i, j, player, board):
    moves = []
    directions = []
    # 各駒の移動方向を設定
    if piece_type == "歩":
        directions = [(-1, 0)] if player == "先手" else [(1, 0)]
    elif piece_type == "香":
        directions = [(-1, 0)] if player == "先手" else [(1, 0)]
    elif piece_type == "桂":
        potential_moves = [(i - 2, j - 1), (i - 2, j + 1)] if player == "先手" else [(i + 2, j - 1), (i + 2, j + 1)]
        return [(ni, nj) for ni, nj in potential_moves if 0 <= ni < 9 and 0 <= nj < 9]
    elif piece_type == "銀":
        directions = [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 1)]
    elif piece_type == "角":
        directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    elif piece_type in ["金", "と", "成香", "成桂", "成銀"]:
        directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0)]
    elif piece_type == "飛":
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    elif piece_type == "王":
        directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    elif piece_type == "馬":
        directions = [(-1, -1), (-1, 1), (1, -1), (1, 1), (-1, 0), (1, 0), (0, -1), (0, 1)]
    elif piece_type == "龍":
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]

    # 各方向に対して移動可能なマスを探索
    for di, dj in directions:
        ni, nj = i + di, j + dj
        while 0 <= ni < 9 and 0 <= nj < 9:
            if board[ni][nj] is None or board[ni][nj]['player'] != player:
                moves.append((ni, nj))
            if board[ni][nj] is not None or piece_type in ["歩", "桂", "銀", "金", "王", "と", "成香", "成桂", "成銀"]:
                break
            ni, nj = ni + di, nj + dj

    return moves

def generate_valid_random_move(board, player):
    # ランダムな合法手を生成
    actions = get_legal_actions(board, player)
    return random.choice(actions) if actions else None

def is_king_in_check(board: List[List[Optional[Dict]]], player: str) -> bool:
    # 王手判定
    opponent = "後手" if player == "先手" else "先手"
    king_pos = None
    
    # 王の位置を探索
    for i in range(9):
        for j in range(9):
            piece = board[i][j]
            if piece and piece['player'] == player and piece['type'] == "王":
                king_pos = (i, j)
                break
        if king_pos:
            break
    
    if not king_pos:
        return False
    
    # 相手の駒が王を取れるかチェック
    for i in range(9):
        for j in range(9):
            piece = board[i][j]
            if piece and piece['player'] == opponent:
                moves = get_piece_moves(piece['type'], i, j, opponent, board)
                if king_pos in moves:
                    return True
    
    return False

def get_safe_moves(board: List[List[Optional[Dict]]], visible_board: List[List[Optional[Dict]]], player: str) -> List[Tuple[int, int, int, int]]:
    # 安全な手を探索
    safe_moves = []
    for i in range(9):
        for j in range(9):
            piece = visible_board[i][j]
            if piece and piece['player'] == player:
                moves = get_piece_moves(piece['type'], i, j, player, visible_board)
                for move in moves:
                    # 移動後の盤面を生成
                    new_board = apply_move(visible_board, (i, j, move[0], move[1]), player)
                    # 移動後に王手でないか確認
                    if not is_king_in_check(new_board, player):
                        safe_moves.append((i, j, move[0], move[1]))
    return safe_moves

def apply_move(board: List[List[Optional[Dict]]], move: Tuple[int, int, int, int], player: str) -> List[List[Optional[Dict]]]:
    # 指定された手を適用した新しい盤面を生成
    new_board = [[cell.copy() if cell else None for cell in row] for row in board]
    i, j, ni, nj = move
    new_board[ni][nj] = new_board[i][j]
    new_board[i][j] = None
    return new_board

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # リクエストボディからJSONデータを取得
        req_body = req.get_json()
        full_board = req_body.get('fullBoard')
        visible_board = req_body.get('visibleBoard')
        player = req_body.get('player')

        # 必要なデータが揃っているか確認
        if not full_board or not visible_board or not player:
            return func.HttpResponse(
                "Please pass fullBoard, visibleBoard, and player in the request body",
                status_code=400
            )
            
        logging.info(f"Received request for player: {player}")
        logging.info(f"Full board state: {full_board}")
        logging.info(f"Visible board state: {visible_board}")

        # 王手判定
        is_in_check = is_king_in_check(full_board, player)
        
        if is_in_check:
            logging.info("Player is in check. Finding safe moves.")
            safe_moves = get_safe_moves(full_board, visible_board, player)
            if safe_moves:
                # 安全な手からランダムに選択
                move = random.choice(safe_moves)
                logging.info(f"Selected safe move: {move}")
            else:
                logging.warning("No safe moves available. Player is in checkmate.")
                return func.HttpResponse(
                    "Checkmate",
                    status_code=200
                )
        else:
            # 通常の手を選択
            move = get_cpu_move(visible_board, player)
        
        if move:
            logging.info(f"CPU move found: {move}")
            return func.HttpResponse(json.dumps({"move": move}))
        else:
            logging.warning("No valid move found")
            return func.HttpResponse(
                "No valid move found",
                status_code=404
            )

    except ValueError as ve:
        logging.error(f"Invalid input: {str(ve)}")
        return func.HttpResponse(
            f"Invalid input: {str(ve)}",
            status_code=400
        )
    except json.JSONDecodeError:
        logging.error("Invalid JSON in request body")
        return func.HttpResponse(
            "Invalid JSON in request body",
            status_code=400
        )
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return func.HttpResponse(
            "An unexpected error occurred",
            status_code=500
        )