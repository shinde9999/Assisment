import { describe, it, expect } from "vitest";
import { autoMap } from "@/lib/import-mapping";

describe("FINDING 7: Spreadsheet autoMap Substring Collisions & Greedy Mis-mapping", () => {
  it("should correctly map 'Min Qty' to moq and 'Quantity' to quantity", () => {
    const headers = ["Min Qty", "Quantity"];
    const mapping = autoMap(headers);

    // EXPECTED BEHAVIOR:
    // "Min Qty" is a clear synonym for Minimum Order Quantity (moq).
    // "Quantity" is the required available stock quantity (quantity).
    //
    // ACTUAL BUG:
    // In src/lib/import-mapping.ts lines 58-61:
    // `keys.some((key) => normalized === key || normalized.includes(key))`
    // Because SYNONYMS.quantity contains "qty" and is evaluated before "moq",
    // "minqty".includes("qty") matches "quantity".
    // "Min Qty" is incorrectly mapped to "quantity", and the actual "Quantity"
    // column is discarded or mapped to "attribute" because "quantity" is already in used!
    expect(mapping["Min Qty"], "'Min Qty' must be mapped to moq").toBe("moq");
    expect(mapping["Quantity"], "'Quantity' must be mapped to quantity").toBe("quantity");
  });

  it("should NOT map 'Warranty Period' to 'category' due to substring 'type'", () => {
    const headers = ["Warranty Period", "Category"];
    const mapping = autoMap(headers);

    // EXPECTED BEHAVIOR:
    // "Warranty Period" is a custom attribute (attribute).
    // "Category" is the product category (category).
    //
    // ACTUAL BUG:
    // SYNONYMS.category contains "type". "warran-type-riod".includes("type") is true!
    // "Warranty Period" greedily consumes "category", and real "Category" falls back to "attribute"!
    expect(mapping["Warranty Period"], "'Warranty Period' should be a custom attribute").toBe("attribute");
    expect(mapping["Category"], "'Category' must be mapped to category").toBe("category");
  });
});
