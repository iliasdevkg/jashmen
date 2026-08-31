/// University league — models for the "Университет лигасы" tab.
///
/// Everything here is server data now. The campus and its contest (prizes,
/// dates, rules) arrive inside `GET /public/content`, authored in the admin
/// panel's Module Г — they used to be hardcoded in `data/universities.dart`
/// and again in the web twin, so a prize pool could only change by shipping
/// both clients. The standings, the viewer count and the energy a viewer
/// gifts a student come from [UniBoard] below.
///
/// Text fields that read differently per language are `dynamic` `{ky,ru,en}`
/// maps, resolved at render time by i18n.dart#localizedContent — the same
/// convention every server-authored content field already uses.
library;

import '../core/config.dart';
import '../core/i18n.dart';
import 'user_state.dart';

/// How the player takes part in the university league.
///
/// A *student* competes for their university — their XP counts towards its
/// total. A *viewer* only reads the standings.
enum UniLeagueRole {
  student('student'),
  viewer('viewer');

  const UniLeagueRole(this.code);
  final String code;

  static UniLeagueRole? fromCode(String? code) {
    for (final r in UniLeagueRole.values) {
      if (r.code == code) return r;
    }
    return null;
  }
}

/// One university's running contest: who organises it, what's at stake and
/// when it closes. Null on a university that hasn't launched one yet.
class UniversityCompetition {
  const UniversityCompetition({
    required this.organizerPhone,
    required this.address,
    required this.prizePool,
    required this.firstPrize,
    required this.secondPrize,
    required this.thirdPrize,
    required this.giftsTopN,
    required this.startsAt,
    required this.endsAt,
    required this.rules,
    this.sponsorName,
    this.sponsorLogoUrl,
  });

  /// Shown verbatim and dialable — the contact for prize questions.
  final String organizerPhone;

  /// `{ky,ru,en}` — the campus the contest is run from.
  final dynamic address;

  /// Sponsor wordmark shown top-right of the card. When no logo is
  /// uploaded the name is set as type instead — a designed fallback, not a
  /// gap.
  final String? sponsorName;
  final String? sponsorLogoUrl;

  /// Sums in KGS. The pool is authored rather than derived: it can exceed
  /// the three placings when the organiser adds gifts on top.
  final int prizePool;
  final int firstPrize;
  final int secondPrize;
  final int thirdPrize;

  /// Everyone up to this rank receives a gift — the 4th prize column.
  final int giftsTopN;

  final DateTime startsAt;
  final DateTime endsAt;

  /// `{ky,ru,en}` — who may enter and win, in the organiser's own words.
  final dynamic rules;

  /// Returns null for a campus with no contest running — the normal state,
  /// and what the card's "no contest yet" panel is for. Dates are parsed
  /// leniently: a malformed one drops the whole contest rather than
  /// throwing, so one bad admin edit can't blank the league.
  static UniversityCompetition? fromJson(dynamic value) {
    if (value is! Map) return null;
    final json = value.cast<String, dynamic>();
    final startsAt = DateTime.tryParse('${json['startsAt']}');
    final endsAt = DateTime.tryParse('${json['endsAt']}');
    if (startsAt == null || endsAt == null) return null;
    return UniversityCompetition(
      organizerPhone: json['organizerPhone']?.toString() ?? '',
      address: json['address'],
      sponsorName: _text(json['sponsorName']),
      sponsorLogoUrl: resolveMediaUrl(json['sponsorLogoUrl']),
      prizePool: _int(json['prizePool']),
      firstPrize: _int(json['firstPrize']),
      secondPrize: _int(json['secondPrize']),
      thirdPrize: _int(json['thirdPrize']),
      giftsTopN: _int(json['giftsTopN']) == 0 ? 10 : _int(json['giftsTopN']),
      startsAt: startsAt,
      endsAt: endsAt,
      rules: json['rules'],
    );
  }
}

String? _text(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

class University {
  const University({
    required this.id,
    required this.listName,
    required this.name,
    required this.shortName,
    required this.color,
    this.logoUrl,
    this.competition,
  });

  final String id;

  /// Label in the picker — the name students actually use out loud
  /// ("ПОЛИТЕХ"), which is not always the legal name on the card.
  final String listName;

  /// `{ky,ru,en}` — full legal name, shown on the contest card.
  final dynamic name;

  /// `{ky,ru,en}` — abbreviation used inside sentences ("ТОП 10 …").
  final dynamic shortName;

  /// Accent hex — the crest tint behind the monogram, and the card's wash.
  final String color;

  /// Uploaded crest. Falls back to a monogram badge in the accent colour,
  /// which is a designed state, not a missing one.
  final String? logoUrl;

  final UniversityCompetition? competition;

  bool get hasCompetition => competition != null;

  factory University.fromJson(Map<String, dynamic> json) => University(
        id: json['id']?.toString() ?? '',
        listName: json['listName']?.toString() ?? '',
        name: json['name'],
        shortName: json['shortName'],
        color: json['color']?.toString() ?? '#1D4ED8',
        logoUrl: resolveMediaUrl(json['logoUrl']),
        competition: UniversityCompetition.fromJson(json['contest']),
      );

  /// "КГТУНУН ТОП 10 СТУДЕНТИ" / "ТОП 10 СТУДЕНТОВ КГТУ" /
  /// "KSTU TOP 10 STUDENTS" — Kyrgyz needs the genitive, which is why this
  /// is built here rather than by string-concatenating in the widget.
  String topStudentsTitle(Strings s, AppLocale locale) {
    final short = localizedContent(shortName, locale);
    return s.t(
      'uni.topStudentsTitle',
      params: {'uni': locale == AppLocale.ky ? kyGenitive(short) : short},
    );
  }
}


// ── Live board (GET /u/university/:id/board) ───────────────────────────────

/// One student on their campus's board. `supporters` is how many distinct
/// viewers have backed them — the small heart count beside a name.
class UniBoardEntry {
  const UniBoardEntry({
    required this.id,
    required this.name,
    required this.rank,
    this.avatar,
    this.xp = 0,
    this.streak = 0,
    this.supporters = 0,
  });

  final String id;
  final String name;
  final String? avatar;
  final int rank;
  final int xp;
  final int streak;
  final int supporters;

  /// The shape the existing podium/row widgets already render (avatars,
  /// initials, colours) — adapting here keeps one avatar implementation
  /// rather than a second one that drifts.
  LeaderboardEntry get asLeaderboardEntry =>
      LeaderboardEntry(id: id, name: name, xp: xp, avatar: avatar, streak: streak);

  factory UniBoardEntry.fromJson(Map<String, dynamic> json) => UniBoardEntry(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        avatar: resolveMediaUrl(json['avatar']),
        rank: _int(json['rank']),
        xp: _int(json['xp']),
        streak: _int(json['streak']),
        supporters: _int(json['supporters']),
      );
}

/// Where the caller sits on the board they are looking at. `rank` is null
/// for a viewer — viewers are counted but never ranked, because their XP
/// belongs to the general league only.
class UniBoardMe {
  const UniBoardMe({this.role, this.rank, this.xp = 0, this.supporters = 0});

  final String? role;
  final int? rank;
  final int xp;
  final int supporters;

  factory UniBoardMe.fromJson(Map<String, dynamic> json) => UniBoardMe(
        role: json['role']?.toString(),
        rank: json['rank'] is num ? (json['rank'] as num).toInt() : null,
        xp: _int(json['xp']),
        supporters: _int(json['supporters']),
      );
}

class UniBoard {
  const UniBoard({
    required this.universityId,
    this.studentCount = 0,
    this.viewerCount = 0,
    this.totalXp = 0,
    this.students = const [],
    this.me = const UniBoardMe(),
  });

  final String universityId;
  final int studentCount;

  /// How many people follow this campus without competing on it — the
  /// number beside the eye badge.
  final int viewerCount;
  final int totalXp;
  final List<UniBoardEntry> students;
  final UniBoardMe me;

  factory UniBoard.fromJson(Map<String, dynamic> json) => UniBoard(
        universityId: json['universityId']?.toString() ?? '',
        studentCount: _int(json['studentCount']),
        viewerCount: _int(json['viewerCount']),
        totalXp: _int(json['totalXp']),
        students: switch (json['students']) {
          List list => list
              .whereType<Map>()
              .map((e) => UniBoardEntry.fromJson(e.cast<String, dynamic>()))
              .toList(growable: false),
          _ => const <UniBoardEntry>[],
        },
        me: json['me'] is Map
            ? UniBoardMe.fromJson((json['me'] as Map).cast<String, dynamic>())
            : const UniBoardMe(),
      );
}

/// One row of "СЕНИ КОЛДОГОНДОР" — a backer folded to a single line with
/// their running total.
class Supporter {
  const Supporter({
    required this.id,
    required this.name,
    this.avatar,
    this.amount = 0,
    this.gifts = 0,
  });

  final String id;
  final String name;
  final String? avatar;
  final int amount;
  final int gifts;

  factory Supporter.fromJson(Map<String, dynamic> json) => Supporter(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        avatar: resolveMediaUrl(json['avatar']),
        amount: _int(json['amount']),
        gifts: _int(json['gifts']),
      );
}

/// What POST /u/university/support returns: the giver's updated account
/// (their energy just went down) and who received it.
class SupportResult {
  const SupportResult({required this.user, required this.amount, required this.toName});

  final AppUser user;
  final int amount;
  final String toName;

  factory SupportResult.fromJson(Map<String, dynamic> json) => SupportResult(
        user: AppUser.fromJson((json['user'] as Map).cast<String, dynamic>()),
        amount: _int(json['amount']),
        toName: (json['to'] as Map?)?['name']?.toString() ?? '',
      );
}

int _int(dynamic v) => switch (v) {
      int i => i,
      num n => n.toInt(),
      String str => int.tryParse(str) ?? 0,
      _ => 0,
    };
