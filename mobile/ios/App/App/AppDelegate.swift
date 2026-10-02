import UIKit
import Capacitor
import Speech
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - Formstand: eigener Bridge-Controller registriert das Sprach-Plugin
class FormstandViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FormstandSpeechPlugin())
    }
}

// MARK: - Spracherkennung, die Musik NICHT anhält
// Safari/Web-Speech schaltet die Audio-Sitzung exklusiv und pausiert Spotify & Co.
// Hier öffnen wir das Mikrofon mit .mixWithOthers – die Musik läuft weiter.
@objc(FormstandSpeechPlugin)
public class FormstandSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FormstandSpeechPlugin"
    public let jsName = "FormstandSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    @objc func available(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "de-CH"
        let rec = SFSpeechRecognizer(locale: Locale(identifier: lang)) ?? SFSpeechRecognizer(locale: Locale(identifier: "de-DE"))
        call.resolve(["available": rec?.isAvailable ?? false])
    }

    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "de-CH"
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { call.reject("Spracherkennung ist nicht erlaubt (Einstellungen → Formstand)."); return }
            self.requestMic { ok in
                guard ok else { call.reject("Mikrofon ist nicht erlaubt (Einstellungen → Formstand)."); return }
                DispatchQueue.main.async {
                    do { try self.begin(lang: lang); call.resolve() }
                    catch { call.reject("Diktieren nicht möglich: \(error.localizedDescription)") }
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Audio beenden; das Endergebnis kommt danach noch als «result» mit final=true
            if self.engine.isRunning { self.engine.stop(); self.engine.inputNode.removeTap(onBus: 0) }
            self.request?.endAudio()
            call.resolve()
        }
    }

    private func requestMic(_ done: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) { AVAudioApplication.requestRecordPermission(completionHandler: done) }
        else { AVAudioSession.sharedInstance().requestRecordPermission(done) }
    }

    private func begin(lang: String) throws {
        cleanup()
        let session = AVAudioSession.sharedInstance()
        // Der entscheidende Teil: mixWithOthers → andere Audio-Apps laufen weiter
        try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP])
        try session.setActive(true)
        guard let rec = SFSpeechRecognizer(locale: Locale(identifier: lang)) ?? SFSpeechRecognizer(locale: Locale(identifier: "de-DE")), rec.isAvailable else {
            throw NSError(domain: "Formstand", code: 1, userInfo: [NSLocalizedDescriptionKey: "Spracherkennung gerade nicht verfügbar"])
        }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true } // bleibt auf dem Gerät
        request = req
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in req.append(buffer) }
        engine.prepare()
        try engine.start()
        task = rec.recognitionTask(with: req) { [weak self] result, error in
            guard let self = self else { return }
            if let r = result {
                self.notifyListeners("result", data: ["text": r.bestTranscription.formattedString, "final": r.isFinal])
            }
            if error != nil || (result?.isFinal ?? false) {
                self.cleanup()
                self.notifyListeners("end", data: [:])
            }
        }
    }

    private func cleanup() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
