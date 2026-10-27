def op_load_prices_file(st):
    """Operation 4: Load stock prices from file."""
    print("\n--- Load Stock Prices from File ---")
    path = input("Enter price filepath (e.g. sample_prices.csv): ").strip()

    try:
        prices, timestamps = load_prices_file(path)
        st.load_data(prices, timestamps)
        print(f"Successfully loaded {st.n} prices from '{path}' into Segment Tree.")
    except Exception as err:
        print(f"Error loading prices file: {err}")


def op_load_queries_file(st):
    """Operation 5: Load queries from file."""
    if st.n == 0:
        print("\nNo stock prices loaded. Please load stock prices first.")
        return

    print("\n--- Load Queries from File ---")
    path = input("Enter query filepath (e.g. sample_queries.txt): ").strip()

    try:
        queries = load_queries_file(path)
        print(f"\nExecuting {len(queries)} queries from '{path}':")
        print(f"{'#':<4} {'Query Range':<28} {'Min Price':<20} {'Max Price':<20} {'Spread':<10}")
        print("-" * 84)

        for i, q in enumerate(queries, 1):
            q_type = q[0]
            if q_type == "index":
                l, r = q[1], q[2]
                if l < 0 or r >= st.n or l > r:
                    print(f"{i:<4} [{l}, {r}]: Out of bounds for size {st.n}")
                    continue
                res = st.query(l, r)
                range_str = f"[{l}, {r}]"
            else:
                start_t, end_t = q[1], q[2]
                try:
                    res, l, r = st.query_by_timestamp(start_t, end_t)
                    range_str = f"{start_t}..{end_t}"
                except ValueError as e:
                    print(f"{i:<4} {start_t}..{end_t}: {e}")
                    continue

            min_info = f"${res.min_price:.2f} ({st.get_timestamp(res.min_idx)})"
            max_info = f"${res.max_price:.2f} ({st.get_timestamp(res.max_idx)})"
            print(f"{i:<4} {range_str:<28} {min_info:<20} {max_info:<20} ${res.spread:.2f}")

    except Exception as err:
        print(f"Error executing queries from file: {err}")


def op_update_price(st):
    """Operation 6: Point update stock price."""
    if st.n == 0:
        print("\nNo stock prices loaded. Please load stock prices first.")
        return
    try:
        idx = int(input(f"Enter index to update (0 to {st.n - 1}): ").strip())
        new_p = float(input("Enter new stock price: ").strip())
        old_p = st.prices[idx]
        st.update(idx, new_p)
        print(f"Updated index {idx} ({st.timestamps[idx]}): ${old_p:.2f} -> ${new_p:.2f}")
    except (ValueError, IndexError) as err:
        print(f"Update error: {err}")


# ==========================================
# Main Menu Loop
# ==========================================
def print_menu():
    print("\n" + "=" * 50)
    print("         STOCK PRICE SEGMENT TREE MONITOR")
    print("=" * 50)
    print("1. Display current timestamp and prices")
    print("2. Query")
    print("3. Regenerate stock prices")
    print("4. Load stock prices from file")
    print("5. Load queries from file")
    print("6. Update price at index")
    print("7. Exit")
    print("=" * 50)


def main():
    st = SegmentTree()
    print("Segment Tree Stock Monitor Initialized (No data loaded).")
    print("Use Option 3 to generate prices or Option 4 to load prices from a file.")

    while True:
        print_menu()
        try:
            choice = input("Enter choice (1-7): ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting. Goodbye!")
            break

        if choice == "1":
            op_display_prices(st)
        elif choice == "2":
            op_query(st)
        elif choice == "3":
            op_regenerate_prices(st)
        elif choice == "4":
            op_load_prices_file(st)
        elif choice == "5":
            op_load_queries_file(st)
        elif choice == "6":
            op_update_price(st)
        elif choice == "7":
            print("\nExiting program. Goodbye!")
            break
        else:
            print("Invalid choice. Please choose an option from 1 to 7.")


if __name__ == "__main__":
    main()
