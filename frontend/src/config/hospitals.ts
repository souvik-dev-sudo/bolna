// Hospitals the super admin can switch between (sidebar card). A demo: the choice changes the
// name shown, not the data. Add a line here to list another hospital.
export interface Hospital {
  id: string;
  name: string;
  initials: string;
}

export const hospitals: Hospital[] = [
  { id: "riti", name: "Riti Eye Care Hospital", initials: "RE" },
  { id: "agarwals", name: "Dr Agarwal's Eye Hospital", initials: "DA" },
];

export const SIGNED_IN_ROLE = "Super admin";
