const KMAP_SAMPLE = {
  name: "K-map wraparound · Sample",
  sourceText: "In a Karnaugh map, Gray-code neighbors differ by one bit. The first and last columns are neighbors.",
  content: {
    scenes: [
      {
        title: "The edges touch",
        caption: "In a K-map, the first and last columns count as neighbors.",
        narration: "K-map edges wrap around. Think of the left and right edges as touching. Those two ones can be neighbors.",
        duration: 11,
        visual: "grid",
        items: ["1", "0", "0", "1", "0", "0", "0", "0"],
        highlighted: [0, 3],
      },
      {
        title: "One bit changes",
        caption: "The columns go 00, 01, 11, 10. The two ends differ in one bit.",
        narration: "Check the column labels. Zero zero and one zero differ by just one bit. That is why those edges count as adjacent.",
        duration: 12,
        visual: "highlight",
        items: ["00", "01", "11", "10"],
        highlighted: [0, 3],
      },
      {
        title: "Keep what stays the same",
        caption: "For a pair, drop the variable that changes and keep the variables that stay fixed.",
        narration: "Group the two ones. The first column bit changes, so drop it. The row bit and the second column bit stay fixed.",
        duration: 12,
        visual: "steps",
        items: ["Group adjacent ones", "Find the bit that changes", "Keep the fixed bits"],
        highlighted: [2],
      },
    ],
    questions: [
      { concept: "edge adjacency", difficulty: "easy", question: "Which two columns can touch across the edges?", options: ["First and last", "First and third", "Second and last", "Only the middle two"], correctIndex: 0, explanation: "The first and last columns are neighbors because the map wraps around." },
      { concept: "edge adjacency", difficulty: "easy", question: "There’s a 1 at each end of the same row. Can those two 1s make a pair?", options: ["Only if the row is full", "Yes, the edges wrap", "No, they are on opposite ends", "Only in different rows"], correctIndex: 1, explanation: "The first and last cells of a row touch across the edge, so the two 1s can pair." },
      { concept: "Gray code", difficulty: "medium", question: "Why are columns 00 and 10 adjacent across the boundary?", options: ["Both bits change", "Neither bit changes", "Only the first bit changes", "Only the second bit changes"], correctIndex: 2, explanation: "Compare 00 and 10. The first bit flips while the second stays zero." },
      { concept: "Gray code", difficulty: "easy", question: "Which column label differs from 00 by one bit?", options: ["11", "00", "01", "All three"], correctIndex: 2, explanation: "00 and 01 differ in the last bit only." },
      { concept: "simplification", difficulty: "hard", question: "Across columns BC = 00 and 10 on row A = 0, which term survives the pair?", options: ["A′B′", "A′C′", "BC′", "AB"], correctIndex: 1, explanation: "A and C stay at zero. B changes, so it drops out. The term is A′C′." },
      { concept: "simplification", difficulty: "medium", question: "A variable changes inside a valid two-cell group. What happens to it?", options: ["It gets squared", "It is always set to one", "It becomes the only variable", "It drops out of the term"], correctIndex: 3, explanation: "A pair simplifies by removing the changing variable and keeping fixed ones." },
    ],
  },
};
