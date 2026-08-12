import * as React from "react";
import { Select } from "./select";

interface SelectProps extends React.ComponentPropsWithoutRef<typeof Select> {}

export const OrganizationTypeSelect = React.forwardRef<HTMLSelectElement, SelectProps>(
  (props, ref) => {
    return (
      <Select ref={ref} {...props}>
        <option value="" disabled>
          Select organization type...
        </option>
        <option value="School">School</option>
        <option value="College">College</option>
        <option value="University">University</option>
        <option value="Healthcare Organization">Healthcare Organization</option>
        <option value="Company">Company</option>
        <option value="Government Organization">Government Organization</option>
        <option value="Non-Profit">Non-Profit</option>
        <option value="Other">Other</option>
      </Select>
    );
  },
);
OrganizationTypeSelect.displayName = "OrganizationTypeSelect";

export const IndustrySelect = React.forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  return (
    <Select ref={ref} {...props}>
      <option value="" disabled>
        Select industry...
      </option>
      <option value="Education">Education</option>
      <option value="Healthcare">Healthcare</option>
      <option value="Corporate">Corporate / Enterprise</option>
      <option value="Government">Government</option>
      <option value="Public Sector">Public Sector</option>
      <option value="Non-Profit">Non-Profit</option>
      <option value="Other">Other</option>
    </Select>
  );
});
IndustrySelect.displayName = "IndustrySelect";
