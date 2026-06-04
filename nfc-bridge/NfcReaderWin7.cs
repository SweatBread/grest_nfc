using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class NfcReaderWin7
{
    // Scope parameters
    public const uint SCARD_SCOPE_USER = 0;
    
    // Share Mode
    public const uint SCARD_SHARE_SHARED = 2;
    public const uint SCARD_SHARE_DIRECT = 3;
    
    // Protocols
    public const uint SCARD_PROTOCOL_T0 = 1;
    public const uint SCARD_PROTOCOL_T1 = 2;
    public const uint SCARD_PROTOCOL_UNDEFINED = 0;
    
    // Dispositions
    public const uint SCARD_LEAVE_CARD = 0;
    public const uint SCARD_UNPOWER_CARD = 2;
    
    // Reader States
    public const uint SCARD_STATE_UNAWARE = 0x00000000;
    public const uint SCARD_STATE_CHANGED = 0x00000002;
    public const uint SCARD_STATE_EMPTY = 0x00000010;
    public const uint SCARD_STATE_PRESENT = 0x00000020;
    
    // Timeout
    public const uint INFINITE = 0xFFFFFFFF;
    
    [DllImport("winscard.dll")]
    public static extern int SCardEstablishContext(uint dwScope, IntPtr pvReserved1, IntPtr pvReserved2, out IntPtr phContext);

    [DllImport("winscard.dll")]
    public static extern int SCardReleaseContext(IntPtr hContext);

    [DllImport("winscard.dll", EntryPoint = "SCardListReadersA", CharSet = CharSet.Ansi)]
    public static extern int SCardListReaders(IntPtr hContext, string mszGroups, byte[] mszReaders, ref uint pcchReaders);

    [DllImport("winscard.dll", EntryPoint = "SCardConnectA", CharSet = CharSet.Ansi)]
    public static extern int SCardConnect(IntPtr hContext, string szReader, uint dwShareMode, uint dwPreferredProtocols, out IntPtr phCard, out uint pdwActiveProtocol);

    [DllImport("winscard.dll")]
    public static extern int SCardDisconnect(IntPtr hCard, uint dwDisposition);

    [DllImport("winscard.dll")]
    public static extern int SCardTransmit(IntPtr hCard, ref SCARD_IO_REQUEST pioSendPci, byte[] pbSendBuffer, int cbSendLength, ref SCARD_IO_REQUEST pioRecvPci, byte[] pbRecvBuffer, ref int pcbRecvLength);

    [DllImport("winscard.dll", EntryPoint = "SCardGetStatusChangeA", CharSet = CharSet.Ansi)]
    public static extern int SCardGetStatusChange(IntPtr hContext, uint dwTimeout, [In, Out] SCARD_READERSTATE[] rgReaderStates, uint cReaders);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct SCARD_READERSTATE
    {
        public string szReader;
        public IntPtr pvUserData;
        public uint dwCurrentState;
        public uint dwEventState;
        public uint cbAtr;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 36)]
        public byte[] rgbAtr;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct SCARD_IO_REQUEST
    {
        public uint dwProtocol;
        public int cbPciLength;
    }

    private static IntPtr hContext = IntPtr.Zero;
    private static string currentReaderName = null;
    private static IntPtr hCard = IntPtr.Zero;
    private static uint activeProtocol = 0;
    private static bool keepRunning = true;
    private static object lockObject = new object();

    public static void Main(string[] args)
    {
        Console.WriteLine("Avvio del bridge NFC Windows 7 in C#...");
        
        // Thread in background per ricevere i comandi da standard input (Beep)
        Thread inputThread = new Thread(ListenToCommands);
        inputThread.IsBackground = true;
        inputThread.Start();

        // Inizializza il contesto PC/SC
        int ret = SCardEstablishContext(SCARD_SCOPE_USER, IntPtr.Zero, IntPtr.Zero, out hContext);
        if (ret != 0)
        {
            Console.WriteLine("ERRORE: Impossibile inizializzare il contesto PC/SC (winscard.dll). Codice: " + ret);
            return;
        }

        Console.WriteLine("READER_STATUS:disconnected");

        SCARD_READERSTATE[] readerStates = new SCARD_READERSTATE[1];
        
        while (keepRunning)
        {
            if (string.IsNullOrEmpty(currentReaderName))
            {
                // Cerca lettori connessi
                currentReaderName = FindReader();
                if (!string.IsNullOrEmpty(currentReaderName))
                {
                    Console.WriteLine("READER_STATUS:connected:" + currentReaderName);
                    
                    readerStates[0] = new SCARD_READERSTATE();
                    readerStates[0].szReader = currentReaderName;
                    readerStates[0].dwCurrentState = SCARD_STATE_UNAWARE;
                }
                else
                {
                    Thread.Sleep(2000);
                    continue;
                }
            }

            // Attende un cambio di stato sul lettore (timeout 1s per non bloccare il thread)
            ret = SCardGetStatusChange(hContext, 1000, readerStates, 1);
            
            if (ret == 0)
            {
                uint eventState = readerStates[0].dwEventState;
                
                // Se il lettore è disconnesso o non disponibile
                if ((eventState & 0x00000008) != 0 || (eventState & 0x00000004) != 0)
                {
                    Console.WriteLine("READER_STATUS:disconnected");
                    lock (lockObject)
                    {
                        if (hCard != IntPtr.Zero)
                        {
                            SCardDisconnect(hCard, SCARD_LEAVE_CARD);
                            hCard = IntPtr.Zero;
                        }
                        currentReaderName = null;
                    }
                    continue;
                }

                // Se una carta è presente sul lettore
                if ((eventState & SCARD_STATE_PRESENT) != 0)
                {
                    bool isNewCard = false;
                    lock (lockObject)
                    {
                        if (hCard == IntPtr.Zero)
                        {
                            // Connettiti alla carta
                            ret = SCardConnect(hContext, currentReaderName, SCARD_SHARE_SHARED, SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, out hCard, out activeProtocol);
                            if (ret == 0)
                            {
                                isNewCard = true;
                            }
                        }
                    }

                    if (isNewCard)
                    {
                        // Leggi UID
                        string uid = ReadCardUid();
                        if (!string.IsNullOrEmpty(uid))
                        {
                            Console.WriteLine("CARD_DETECTED:" + uid);
                        }
                    }
                }
                else
                {
                    // Carta rimossa
                    lock (lockObject)
                    {
                        if (hCard != IntPtr.Zero)
                        {
                            SCardDisconnect(hCard, SCARD_LEAVE_CARD);
                            hCard = IntPtr.Zero;
                        }
                    }
                }

                // Aggiorna lo stato corrente per il ciclo successivo
                readerStates[0].dwCurrentState = eventState;
            }
            else if (ret != unchecked((int)0x8010000A)) // Ignora il timeout standard (SCARD_E_TIMEOUT)
            {
                // Altro errore (lettore disconnesso fisicamente)
                Console.WriteLine("READER_STATUS:disconnected");
                lock (lockObject)
                {
                    if (hCard != IntPtr.Zero)
                    {
                        SCardDisconnect(hCard, SCARD_LEAVE_CARD);
                        hCard = IntPtr.Zero;
                    }
                    currentReaderName = null;
                }
                Thread.Sleep(1000);
            }
        }

        if (hContext != IntPtr.Zero)
        {
            SCardReleaseContext(hContext);
        }
    }

    private static string FindReader()
    {
        uint pcchReaders = 0;
        int ret = SCardListReaders(hContext, null, null, ref pcchReaders);
        if (ret != 0 || pcchReaders == 0)
        {
            return null;
        }

        byte[] mszReaders = new byte[pcchReaders];
        ret = SCardListReaders(hContext, null, mszReaders, ref pcchReaders);
        if (ret != 0)
        {
            return null;
        }

        // Il formato PC/SC restituisce i nomi dei lettori separati da \0, terminando con \0\0
        string ascii = Encoding.ASCII.GetString(mszReaders);
        string[] readers = ascii.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
        if (readers.Length > 0)
        {
            return readers[0]; // Restituisce il primo lettore trovato
        }
        return null;
    }

    private static string ReadCardUid()
    {
        SCARD_IO_REQUEST pioSendPci = new SCARD_IO_REQUEST();
        pioSendPci.dwProtocol = activeProtocol;
        pioSendPci.cbPciLength = Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

        SCARD_IO_REQUEST pioRecvPci = new SCARD_IO_REQUEST();
        pioRecvPci.dwProtocol = activeProtocol;
        pioRecvPci.cbPciLength = Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

        // APDU standard ISO 14443-3 per ottenere l'UID (Get Data) -> FF CA 00 00 00
        byte[] apdu = new byte[] { 0xFF, 0xCA, 0x00, 0x00, 0x00 };
        byte[] response = new byte[258];
        int responseLength = response.Length;

        lock (lockObject)
        {
            if (hCard == IntPtr.Zero) return null;

            int ret = SCardTransmit(hCard, ref pioSendPci, apdu, apdu.Length, ref pioRecvPci, response, ref responseLength);
            if (ret == 0 && responseLength >= 2)
            {
                // Gli ultimi due byte sono lo stato (es: 90 00 indica successo)
                int uidLength = responseLength - 2;
                if (response[uidLength] == 0x90 && response[uidLength + 1] == 0x00)
                {
                    StringBuilder hex = new StringBuilder(uidLength * 2);
                    for (int i = 0; i < uidLength; i++)
                    {
                        hex.AppendFormat("{0:x2}", response[i]);
                    }
                    return hex.ToString();
                }
            }
        }
        return null;
    }

    private static void ListenToCommands()
    {
        while (keepRunning)
        {
            string line = Console.ReadLine();
            if (line == null) break;

            line = line.Trim();
            if (line.StartsWith("BEEP:"))
            {
                string type = line.Substring(5).ToLower();
                byte reps = (byte)(type == "error" ? 0x03 : 0x01);
                
                // APDU ACR122U Beep command: FF 00 40 00 04 02 01 01 <reps>
                byte[] apdu = new byte[] { 0xFF, 0x00, 0x40, 0x00, 0x04, 0x02, 0x01, 0x01, reps };
                
                lock (lockObject)
                {
                    if (hCard != IntPtr.Zero)
                    {
                        SCARD_IO_REQUEST pioSendPci = new SCARD_IO_REQUEST();
                        pioSendPci.dwProtocol = activeProtocol;
                        pioSendPci.cbPciLength = Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

                        SCARD_IO_REQUEST pioRecvPci = new SCARD_IO_REQUEST();
                        pioRecvPci.dwProtocol = activeProtocol;
                        pioRecvPci.cbPciLength = Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

                        byte[] response = new byte[258];
                        int responseLength = response.Length;

                        SCardTransmit(hCard, ref pioSendPci, apdu, apdu.Length, ref pioRecvPci, response, ref responseLength);
                    }
                }
            }
            else if (line == "EXIT")
            {
                keepRunning = false;
                break;
            }
        }
    }
}
