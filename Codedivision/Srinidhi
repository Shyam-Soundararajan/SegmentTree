def load_queries_file(filepath):
    """Loads range queries (indices or timestamps) from a file."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: '{filepath}'")

    queries = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            clean = line.strip()
            if not clean or clean.startswith("#"):
                continue

            parts = [p.strip() for p in clean.replace(",", " ").split()]
            if len(parts) < 2:
                continue

            try:
                l, r = int(parts[0]), int(parts[1])
                queries.append(("index", l, r))
            except ValueError:
                queries.append(("time", parts[0], parts[1]))

    return queries


# ==========================================
# Menu Operations Implementation
# ==========================================
def op_display_prices(st):
    """Operation 1: Display current timestamp and prices."""
    if st.n == 0:
        print("\nNo stock prices loaded. Please load or generate prices first.")
        return

    print(f"\n--- Current Stock Feed ({st.n} records) ---")
    print(f"{'Index':<8} {'Timestamp':<14} {'Price':<12}")
    print("-" * 34)

    if st.n <= 50:
        for i in range(st.n):
            print(f"[{i:<4}]  {st.timestamps[i]:<14} ${st.prices[i]:.2f}")
    else:
        for i in range(15):
            print(f"[{i:<4}]  {st.timestamps[i]:<14} ${st.prices[i]:.2f}")
        print(f"{'...':^34}")
        for i in range(st.n - 5, st.n):
            print(f"[{i:<4}]  {st.timestamps[i]:<14} ${st.prices[i]:.2f}")
        print(f"\n(Showing 20 of {st.n} total records)")


def op_query(st):
    """Operation 2: Query by index or timestamp."""
    if st.n == 0:
        print("\nNo stock prices loaded. Please load or generate prices first.")
        return

    print("\n--- Query Options ---")
    print("  1. Query by Index range [L, R]")
    print("  2. Query by Timestamp range [Start_Time, End_Time]")
    choice = input("Select query type (1 or 2): ").strip()

    try:
        if choice == "2":
            start_t = input(f"Enter start timestamp (e.g. {st.timestamps[0]}): ").strip()
            end_t = input(f"Enter end timestamp   (e.g. {st.timestamps[-1]}): ").strip()
            res, l_idx, r_idx = st.query_by_timestamp(start_t, end_t)
            print(f"\n[Result for Timestamps: {start_t} to {end_t} (Indices {l_idx} to {r_idx})]")
        else:
            l_str = input(f"Enter start index (0 to {st.n - 1}): ").strip()
            r_str = input(f"Enter end index   (0 to {st.n - 1}): ").strip()
            l_idx, r_idx = int(l_str), int(r_str)
            res = st.query(l_idx, r_idx)
            print(f"\n[Result for Indices [{l_idx}, {r_idx}] ({st.timestamps[l_idx]} to {st.timestamps[r_idx]})]")

        min_time = st.get_timestamp(res.min_idx)
        max_time = st.get_timestamp(res.max_idx)
        print(f"  Min Price : ${res.min_price:.2f} (at {min_time}, index {res.min_idx})")
        print(f"  Max Price : ${res.max_price:.2f} (at {max_time}, index {res.max_idx})")
        print(f"  Spread    : ${res.spread:.2f}")

    except (ValueError, IndexError) as err:
        print(f"Query Error: {err}")


def op_regenerate_prices(st):
    """Operation 3: Regenerate stock prices."""
    print("\n--- Regenerate Stock Prices ---")
    try:
        count = int(input("Enter number of price ticks to generate: ").strip())
        start_p = float(input("Enter starting stock price: ").strip())
        start_t = input("Enter starting timestamp (e.g. 09:30:00): ").strip()

        prices, timestamps = generate_synthetic_prices(count, start_p, start_t)
        st.load_data(prices, timestamps)
        print(f"Successfully generated and loaded {st.n} stock prices into Segment Tree.")
    except Exception as err:
        print(f"Error generating prices: {err}")
