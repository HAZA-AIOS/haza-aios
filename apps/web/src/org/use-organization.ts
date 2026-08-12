import { useContext } from "react";
import { OrgContext } from "./OrgContext";

export const useOrganization = () => {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrgProvider");
  }
  return context;
};
