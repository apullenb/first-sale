// What the owner saw when they recorded a decision, kept with it in the history

export interface DecisionBasis {
  // Hash of the answers it was made on (profileKey), to spot answers changed since
  profileKey: string;
  // Owner-facing lines: "2 owners", "Selling food made at home"
  answers: string[];
  // The suggested path at the time, by option id, and whether they followed it
  suggested: string | null;
}
