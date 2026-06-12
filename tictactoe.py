#!/usr/bin/env python3

def print_board(b):
    for i in range(0, 9, 3):
        print(f" {b[i]} | {b[i+1]} | {b[i+2]} ")
        if i < 6:
            print("-----------")

def check_win(b, p):
    wins = [(0,1,2),(3,4,5),(6,7,8),(0,3,6),(1,4,7),(2,5,8),(0,4,8),(2,4,6)]
    return any(b[a] == b[c] == b[d] == p for a, c, d in wins)

def play():
    board = [str(i) for i in range(9)]
    player = 'X'
    moves_made = 0

    while moves_made < 9:
        print_board(board)

        while True:
            try:
                move = int(input(f"Player {player}, enter position (0-8): "))
                if 0 <= move <= 8:
                    break
                print("Please enter a number between 0 and 8.")
            except ValueError:
                print("Invalid input! Please enter a number.")

        if board[move] in 'XO':
            print("Invalid move!")
            continue

        board[move] = player
        moves_made += 1

        if check_win(board, player):
            print_board(board)
            print(f"Player {player} wins!")
            return

        player = 'O' if player == 'X' else 'X'

    print_board(board)
    print("Draw!")

if __name__ == "__main__":
    play()
