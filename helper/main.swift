// RoarMind's helper: the text inside PDFs (PDFKit) and the words in pictures (Vision, the Mac's own text recognition,
// as Live Text), for the app to index. It stays open while the app reads: a line in, "pdf<TAB>/path" or
// "ocr<TAB>/path", a line of JSON out, {"text": "..."}. Built for Apple Silicon and Intel in one file (see
// .github/workflows). `roarmind-helper selftest` makes a PDF and a picture with words and reads them back.
import Foundation
import PDFKit
import Vision
import AppKit

setpriority(PRIO_PROCESS, 0, 10)

func pdfText(_ path: String) -> String {
    guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else { return "" }
    var out = ""
    for i in 0..<min(doc.pageCount, 80) {
        if let s = doc.page(at: i)?.string { out += s + "\n\n" }
        if out.count > 400_000 { break }
    }
    // a scanned PDF has no text: the words on its first pages, read as pictures
    if out.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        for i in 0..<min(doc.pageCount, 5) {
            guard let page = doc.page(at: i) else { continue }
            let box = page.bounds(for: .mediaBox)
            let scale: CGFloat = 2
            let img = page.thumbnail(of: NSSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
            if let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) { out += recognize(cg) + "\n\n" }
        }
    }
    return out
}

func recognize(_ cg: CGImage) -> String {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    if #available(macOS 13.0, *) { req.automaticallyDetectsLanguage = true }
    // Greek where this Mac's Vision knows it, then English
    if let supported = try? req.supportedRecognitionLanguages() {
        let want = ["el-GR", "en-US"].filter { supported.contains($0) }
        if !want.isEmpty { req.recognitionLanguages = want }
    }
    do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req]) } catch { return "" }
    return (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

func ocrText(_ path: String) -> String {
    guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return "" }
    return recognize(cg)
}

func reply(_ text: String) {
    let data = (try? JSONSerialization.data(withJSONObject: ["text": text], options: [])) ?? Data("{\"text\":\"\"}".utf8)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}

func selftest() -> Int32 {
    let dir = FileManager.default.temporaryDirectory
    // a PDF with words
    let pdfURL = dir.appendingPathComponent("roarmind-selftest.pdf")
    var media = CGRect(x: 0, y: 0, width: 595, height: 842)
    guard let ctx = CGContext(pdfURL as CFURL, mediaBox: &media, nil) else { return 1 }
    ctx.beginPDFPage(nil)
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
    NSAttributedString(string: "RoarMind quotation 2024", attributes: [.font: NSFont.systemFont(ofSize: 28)]).draw(at: NSPoint(x: 60, y: 700))
    ctx.endPDFPage(); ctx.closePDF()
    let p = pdfText(pdfURL.path)
    // a picture with words
    let img = NSImage(size: NSSize(width: 900, height: 200))
    img.lockFocus()
    NSColor.white.setFill(); NSRect(x: 0, y: 0, width: 900, height: 200).fill()
    NSAttributedString(string: "Screenshot invoice 4512", attributes: [.font: NSFont.systemFont(ofSize: 48), .foregroundColor: NSColor.black]).draw(at: NSPoint(x: 40, y: 70))
    img.unlockFocus()
    let pngURL = dir.appendingPathComponent("roarmind-selftest.png")
    if let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) { try? png.write(to: pngURL) }
    let o = ocrText(pngURL.path)
    print("pdf: \(p.trimmingCharacters(in: .whitespacesAndNewlines))")
    print("ocr: \(o)")
    return p.contains("quotation") && o.lowercased().contains("invoice") ? 0 : 1
}

let args = CommandLine.arguments
if args.count >= 2 && args[1] == "selftest" { exit(selftest()) }
if args.count >= 3 && args[1] == "pdf" { print(pdfText(args[2])); exit(0) }
if args.count >= 3 && args[1] == "ocr" { print(ocrText(args[2])); exit(0) }
// serve: one request a line until the app closes the pipe
while let line = readLine(strippingNewline: true) {
    let parts = line.split(separator: "\t", maxSplits: 1).map(String.init)
    guard parts.count == 2 else { reply(""); continue }
    autoreleasepool { reply(parts[0] == "pdf" ? pdfText(parts[1]) : parts[0] == "ocr" ? ocrText(parts[1]) : "") }
}
