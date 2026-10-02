import { describe, it, expect } from "vitest";
import {
  autoMap,
  parseNumber,
  validateRows,
  type ParsedFile,
} from "@/lib/import-mapping";

describe("Import Mapping & Spreadsheet Validation (Unit)", () => {
  describe("parseNumber", () => {
    it("parses plain integers and decimal strings", () => {
      expect(parseNumber("100")).toBe(100);
      expect(parseNumber("123.45")).toBe(123.45);
      expect(parseNumber("0")).toBe(0);
    });

    it("strips common currency symbols and comma separators", () => {
      expect(parseNumber("₹1,20,000")).toBe(120000);
      expect(parseNumber("$5,499.50")).toBe(5499.5);
      expect(parseNumber("€ 999")).toBe(999);
      expect(parseNumber("  1,500  ")).toBe(1500);
    });

    it("returns null for empty, undefined or non-numeric strings", () => {
      expect(parseNumber(undefined)).toBeNull();
      expect(parseNumber("")).toBeNull();
      expect(parseNumber("   ")).toBeNull();
      expect(parseNumber("N/A")).toBeNull();
      expect(parseNumber("price on request")).toBeNull();
    });
  });

  describe("autoMap", () => {
    it("maps standard headers to correct FieldKeys", () => {
      const headers = [
        "SKU",
        "Product Name",
        "Brand",
        "Category",
        "Offer Price",
        "MRP",
        "Available Quantity",
        "MOQ",
        "Description",
        "Image URL",
      ];
      const mapping = autoMap(headers);
      expect(mapping["SKU"]).toBe("sku");
      expect(mapping["Product Name"]).toBe("name");
      expect(mapping["Brand"]).toBe("brand");
      expect(mapping["Category"]).toBe("category");
      expect(mapping["Offer Price"]).toBe("offerPrice");
      expect(mapping["MRP"]).toBe("mrp");
      expect(mapping["Available Quantity"]).toBe("quantity");
      expect(mapping["MOQ"]).toBe("moq");
      expect(mapping["Description"]).toBe("description");
      expect(mapping["Image URL"]).toBe("imageUrl");
    });

    it("falls back to 'attribute' for unrecognized headers", () => {
      const headers = ["Color", "Material", "Origin Country"];
      const mapping = autoMap(headers);
      expect(mapping["Color"]).toBe("attribute");
      expect(mapping["Material"]).toBe("attribute");
      expect(mapping["Origin Country"]).toBe("attribute");
    });

    it("maps each recognized FieldKey at most once", () => {
      const headers = ["Product Code", "SKU", "Item Code"];
      const mapping = autoMap(headers);
      const usedFields = Object.values(mapping).filter((v) => v !== "attribute");
      const uniqueFields = new Set(usedFields);
      expect(usedFields.length).toBe(uniqueFields.size);
    });
  });

  describe("validateRows", () => {
    const validHeaders = ["SKU", "Product Name", "Available Quantity", "Offer Price", "MRP", "Image URL", "Color"];
    const validMapping = autoMap(validHeaders);

    it("accepts valid rows and maps them to ImportRow objects", () => {
      const file: ParsedFile = {
        name: "products.csv",
        sizeKB: 2,
        headers: validHeaders,
        rows: [
          {
            SKU: "TEST-01",
            "Product Name": "Test Product One",
            "Available Quantity": "50",
            "Offer Price": "299",
            MRP: "499",
            "Image URL": "https://images.example.com/p1.jpg",
            Color: "Red",
          },
        ],
      };

      const result = validateRows(file, validMapping);
      expect(result.issues).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].sku).toBe("TEST-01");
      expect(result.rows[0].name).toBe("Test Product One");
      expect(result.rows[0].quantity).toBe(50);
      expect(result.rows[0].offerPrice).toBe(299);
      expect(result.rows[0].mrp).toBe(499);
      expect(result.rows[0].imageUrl).toBe("https://images.example.com/p1.jpg");
      expect(result.rows[0].attributes).toEqual({ Color: "Red" });
      expect(result.warnings).toBe(0);
      expect(result.missingPrices).toBe(0);
    });

    it("flags missing SKU as a blocking error", () => {
      const file: ParsedFile = {
        name: "products.csv",
        sizeKB: 1,
        headers: validHeaders,
        rows: [
          {
            SKU: "   ",
            "Product Name": "No SKU Product",
            "Available Quantity": "10",
          },
        ],
      };
      const result = validateRows(file, validMapping);
      expect(result.issues.some((i) => i.blocking && i.message.includes("SKU is missing"))).toBe(true);
      expect(result.rows).toHaveLength(0);
    });

    it("flags duplicate SKUs within the sheet as blocking errors", () => {
      const file: ParsedFile = {
        name: "products.csv",
        sizeKB: 1,
        headers: validHeaders,
        rows: [
          { SKU: "DUP-01", "Product Name": "Item 1", "Available Quantity": "10" },
          { SKU: "DUP-01", "Product Name": "Item 2", "Available Quantity": "20" },
        ],
      };
      const result = validateRows(file, validMapping);
      expect(result.issues.some((i) => i.blocking && i.message.includes("appears more than once"))).toBe(true);
      expect(result.rows).toHaveLength(1); // Only the first row was recorded
    });

    it("flags invalid quantity (negative or decimal) as blocking", () => {
      const file: ParsedFile = {
        name: "products.csv",
        sizeKB: 1,
        headers: validHeaders,
        rows: [
          { SKU: "QTY-01", "Product Name": "Negative Qty", "Available Quantity": "-5" },
          { SKU: "QTY-02", "Product Name": "Fractional Qty", "Available Quantity": "5.5" },
          { SKU: "QTY-03", "Product Name": "Text Qty", "Available Quantity": "many" },
        ],
      };
      const result = validateRows(file, validMapping);
      expect(result.issues.filter((i) => i.blocking)).toHaveLength(3);
    });

    it("warns and ignores non-HTTPS image URLs without blocking the row", () => {
      const file: ParsedFile = {
        name: "products.csv",
        sizeKB: 1,
        headers: validHeaders,
        rows: [
          {
            SKU: "IMG-01",
            "Product Name": "Http Image",
            "Available Quantity": "10",
            "Image URL": "http://insecure.com/photo.jpg",
          },
        ],
      };
      const result = validateRows(file, validMapping);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].blocking).toBe(false);
      expect(result.warnings).toBe(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].imageUrl).toBeUndefined();
    });

    it("tracks count of rows with missing prices", () => {
      const file: ParsedFile = {
        name: "products.csv",
        sizeKB: 1,
        headers: validHeaders,
        rows: [
          { SKU: "P-01", "Product Name": "Has Prices", "Available Quantity": "10", "Offer Price": "100", MRP: "150" },
          { SKU: "P-02", "Product Name": "Missing Offer", "Available Quantity": "10", MRP: "150" },
          { SKU: "P-03", "Product Name": "Missing Both", "Available Quantity": "10" },
        ],
      };
      const result = validateRows(file, validMapping);
      expect(result.missingPrices).toBe(2);
    });
  });
});
